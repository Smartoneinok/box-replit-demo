import BoxSDK from "box-node-sdk";
import type { User } from "@shared/schema";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

// Validate required environment variables
const requiredEnvVars = [
  "BOX_CLIENT_ID",
  "BOX_CLIENT_SECRET",
  "BOX_ENTERPRISE_ID",
  "BOX_PUBLIC_KEY_ID",
  "BOX_PRIVATE_KEY",
  "BOX_PRIVATE_KEY_PASSPHRASE",
] as const;

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Configure the Box SDK with JWT authentication
const sdk = new BoxSDK({
  clientID: process.env.BOX_CLIENT_ID,
  clientSecret: process.env.BOX_CLIENT_SECRET,
  appAuth: {
    keyID: process.env.BOX_PUBLIC_KEY_ID,
    privateKey: process.env.BOX_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    passphrase: process.env.BOX_PRIVATE_KEY_PASSPHRASE,
  },
});

// Get the service account client for creating app users
const serviceClient = sdk.getAppAuthClient(
  "enterprise",
  process.env.BOX_ENTERPRISE_ID,
);

export async function createBoxAppUser(username: string): Promise<string> {
  console.log("Starting Box App User creation for:", username);

  try {
    // Create Box App User
    const boxUserParams = {
      name: username,
      is_platform_access_only: true,
      external_app_user_id: username,
    };

    console.log("Creating Box App User with params:", boxUserParams);

    const boxUser = await serviceClient.enterprise.addAppUser(
      username,
      boxUserParams,
    );

    console.log("Successfully created Box App User:", {
      box_user_id: boxUser.id,
      box_login: boxUser.login,
    });

    // Get user client for the new app user
    const userClient = sdk.getAppAuthClient("user", boxUser.id);

    // Create folder structure under the user's context
    try {
      console.log("Creating folder structure for user");

      // Create root folder with user's name
      const rootFolder = await userClient.folders.create(
        "0", // Parent folder ID (root)
        username,
      );

      // Create statements folder
      const statementsFolder = await userClient.folders.create(
        rootFolder.id,
        "My Statements",
      );

      // Create uploads folder under statements
      const uploadsFolder = await userClient.folders.create(
        statementsFolder.id,
        "Uploads",
      );

      console.log("Successfully created folder structure:", {
        root_folder_id: rootFolder.id,
        statements_folder_id: statementsFolder.id,
        uploads_folder_id: uploadsFolder.id,
      });

      // Add collaboration for service account
      try {
        console.log("Setting up folder collaboration");

        await userClient.collaborations.createWithUserID(
          (await serviceClient.users.get("me")).id,
          rootFolder.id,
          serviceClient.collaborationRoles.CO_OWNER,
        );

        console.log("Successfully added folder collaboration");
      } catch (error) {
        console.error("Failed to create folder collaboration:", error);
        // Don't throw here - folder structure is already created
      }

      return boxUser.id;
    } catch (folderError) {
      console.error("Failed to create folder structure:", folderError);
      throw new Error(
        "Folder structure creation failed: " + (folderError as Error).message,
      );
    }
  } catch (error) {
    console.error("Critical error in Box operations:", error);

    if ((error as any).response) {
      console.error("Box API Error Details:", {
        status: (error as any).response.status,
        statusText: (error as any).response.statusText,
        data: (error as any).response.data,
      });
    }

    throw new Error(
      "Box post-registration process failed: " + (error as Error).message,
    );
  }
}

async function updateUserTokenInfo(
  userId: number,
  tokenInfo: { accessToken: string; expiresAt: Date },
) {
  await db
    .update(users)
    .set({
      boxAccessToken: tokenInfo.accessToken,
      boxTokenExpiresAt: tokenInfo.expiresAt,
    })
    .where(eq(users.id, userId));
}

export async function getBoxClient(user: User) {
  if (!user.boxUserId) {
    throw new Error("User does not have an associated Box account");
  }

  try {
    // Check if we have a valid token
    if (user.boxAccessToken && user.boxTokenExpiresAt) {
      const now = new Date();
      // Add 5 minutes buffer to ensure token doesn't expire during use
      const expirationBuffer = new Date(now.getTime() + 5 * 60 * 1000);

      if (user.boxTokenExpiresAt > expirationBuffer) {
        // Token is still valid, create client with existing token
        return sdk.getBasicClient(user.boxAccessToken);
      }
    }

    // Get a new token
    const client = sdk.getAppAuthClient("user", user.boxUserId);

    // Exchange token with correct scopes
    const tokenInfo = await client.exchangeToken([
      "base_explorer",
      "base_upload",
      "item_preview",
      "item_download",
      "item_upload",
    ]);

    // Calculate token expiration
    const expiresIn = Number(tokenInfo.expiresIn) || 3600; // Default to 1 hour if invalid
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    if (isNaN(expiresAt.getTime())) {
      throw new Error("Invalid expiration time calculated");
    }

    // Store the new token
    await updateUserTokenInfo(user.id, {
      accessToken: tokenInfo.accessToken,
      expiresAt,
    });

    // Return client with new token
    return sdk.getBasicClient(tokenInfo.accessToken);
  } catch (error) {
    console.error("Error getting Box client:", error);
    if ((error as any).response) {
      console.error("Box API Error Details:", {
        status: (error as any).response.status,
        statusText: (error as any).response.statusText,
        data: (error as any).response.data,
      });
    }
    throw new Error("Failed to get Box client");
  }
}
