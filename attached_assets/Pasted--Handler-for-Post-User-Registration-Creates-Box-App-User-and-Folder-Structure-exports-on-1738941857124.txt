/**
 * Handler for Post User Registration - Creates Box App User and Folder Structure
 */
exports.onExecutePostUserRegistration = async function(event) {
    console.log('Starting Box App User creation for:', event.user.email);
  
    try {
        const BoxSDK = require('box-node-sdk');
        
        const privateKey = event.secrets.BOX_PRIVATE_KEY
            .replace(/\\n/g, '\n')
            .trim();
        
        // Initialize SDK with service account credentials
        const sdk = new BoxSDK({
            clientID: event.secrets.BOX_CLIENT_ID,
            clientSecret: event.secrets.BOX_CLIENT_SECRET,
            appAuth: {
                keyID: event.secrets.BOX_KEY_ID,
                privateKey: privateKey,
                passphrase: event.secrets.BOX_PASSPHRASE
            }
        });
  
        // Get service account client
        const serviceClient = sdk.getAppAuthClient('enterprise', event.secrets.BOX_ENTERPRISE_ID);
        
        // Create Box App User
        let boxUser;
        try {
            const boxUserParams = {
                name: event.user.name || event.user.email,
                is_platform_access_only: true,
                external_app_user_id: event.user.user_id
            };
  
            console.log('Creating Box App User with params:', boxUserParams);
  
            boxUser = await serviceClient.enterprise.addAppUser(
                event.user.email, 
                boxUserParams
            );
  
            console.log('Successfully created Box App User:', {
                box_user_id: boxUser.id,
                box_login: boxUser.login
            });
        } catch (error) {
            console.error('Failed to create Box App User:', error);
            throw new Error('Box App User creation failed: ' + error.message);
        }
  
        // Get user client for the new app user
        const userClient = sdk.getAppAuthClient('user', boxUser.id);
  
        // Create folder structure under the user's context
        let rootFolder, statementsFolder, uploadsFolder;
        try {
            console.log('Creating folder structure for user');
  
            // Create root folder with user's name in their context
            rootFolder = await userClient.folders.create(
                '0', // Parent folder ID (root)
                boxUser.name
            );
  
            // Create statements folder
            statementsFolder = await userClient.folders.create(
                rootFolder.id,
                'My Statements'
            );
  
            // Create uploads folder under statements
            uploadsFolder = await userClient.folders.create(
                statementsFolder.id,
                'Uploads'
            );
  
            console.log('Successfully created folder structure:', {
                root_folder_id: rootFolder.id,
                statements_folder_id: statementsFolder.id,
                uploads_folder_id: uploadsFolder.id
            });
        } catch (error) {
            console.error('Failed to create folder structure:', error);
            throw new Error('Folder structure creation failed: ' + error.message);
        }
  
        // Add collaborations
        try {
            console.log('Setting up folder collaboration');
            
            await userClient.collaborations.createWithUserID(
                (await serviceClient.users.get('me')).id,
                rootFolder.id,
                serviceClient.collaborationRoles.CO_OWNER
            );
  
            console.log('Successfully added folder collaboration');
        } catch (error) {
            console.error('Failed to create folder collaboration:', error);
            // Don't throw here - folder structure is already created
            // Log error but allow the process to complete
        }
  
              // Add collaborations
        try {
            console.log('Setting up file collaboration');
  
            await serviceClient.collaborations.createWithUserID(
              boxUser.id, 
              event.secrets.PREVIEW_FILE_ID,
              serviceClient.collaborationRoles.VIEWER,
              {
                  type: serviceClient.itemTypes.FILE
              }
          );   
            console.log('Successfully added file collaboration');
        } catch (error) {
            console.error('Failed to create file collaboration:', error);
            // Don't throw here - folder structure is already created
            // Log error but allow the process to complete
        }
  
        // Copy Dummy Statements
        try {
            console.log('Copying dummy statements');
            
            var mayStatement = await serviceClient.files.copy(event.secrets.DUMMY_STATEMENT_ID, statementsFolder.id, {name: 'May 2024 Statement.pdf'});
            console.log("May Statement File ID: ", mayStatement.id)
            var juneStatement = await serviceClient.files.copy(event.secrets.DUMMY_STATEMENT_ID, statementsFolder.id, {name: 'June 2024 Statement.pdf'});
            console.log("June Statement File ID: ", juneStatement.id)
            var julyStatement = await serviceClient.files.copy(event.secrets.DUMMY_STATEMENT_ID, statementsFolder.id, {name: 'July 2024 Statement.pdf'});
            console.log("July Statement File ID: ", julyStatement.id)
            
            console.log('Successfully copied dummy statements');
        } catch (error) {
            console.error('Failed to copy dummy statements:', error);
            // Don't throw here - folder structure is already created
            // Log error but allow the process to complete
        }
  
        return {
            success: true,
            boxUser: {
                id: boxUser.id,
                login: boxUser.login
            },
            folders: {
                root: rootFolder.id,
                statements: statementsFolder.id,
                uploads: uploadsFolder.id
            }
        };
  
    } catch (error) {
        console.error('Critical error in Box operations:', error);
        
        if (error.response) {
            console.error('Box API Error Details:', {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data
            });
        }
  
        // Propagate error for handling by the calling function
        throw new Error('Box post-registration process failed: ' + error.message);
    }
  };