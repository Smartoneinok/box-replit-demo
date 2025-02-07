import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { BoxFile, BoxFolder } from "@shared/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Folder, File, LogOut, ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

export default function HomePage() {
  const { user, logoutMutation } = useAuth();
  const [currentFolderId, setCurrentFolderId] = useState<string>("0");
  const [folderPath, setFolderPath] = useState<Array<{ id: string; name: string }>>([
    { id: "0", name: "Root" },
  ]);

  const { data: boxData, isLoading } = useQuery<{
    total_count: number;
    entries: (BoxFile | BoxFolder)[];
  }>({
    queryKey: ["/api/files", currentFolderId],
    queryFn: async ({ queryKey }) => {
      const [endpoint, folderId] = queryKey;
      const res = await fetch(`${endpoint}?folderId=${folderId}`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch files");
      }
      return res.json();
    },
    enabled: !!user,
  });

  const handleFolderClick = (folder: BoxFolder) => {
    setCurrentFolderId(folder.id);
    setFolderPath([...folderPath, { id: folder.id, name: folder.name }]);
  };

  const handleBackClick = () => {
    if (folderPath.length > 1) {
      const newPath = [...folderPath];
      newPath.pop();
      setFolderPath(newPath);
      setCurrentFolderId(newPath[newPath.length - 1].id);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">Welcome, {user?.username}</h1>
          <Button
            variant="ghost"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-6">
          {folderPath.length > 1 && (
            <Button variant="outline" size="sm" onClick={handleBackClick}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          )}
          <h2 className="text-2xl font-bold">
            {folderPath[folderPath.length - 1].name}
          </h2>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Modified</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : boxData?.entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center">
                    No files found in this folder.
                  </TableCell>
                </TableRow>
              ) : (
                boxData?.entries.map((item) => (
                  <TableRow
                    key={item.id}
                    className={item.type === "folder" ? "cursor-pointer hover:bg-muted/50" : ""}
                    onClick={() => {
                      if (item.type === "folder") {
                        handleFolderClick(item as BoxFolder);
                      }
                    }}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {item.type === "folder" ? (
                          <Folder className="h-4 w-4" />
                        ) : (
                          <File className="h-4 w-4" />
                        )}
                        {item.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.type === "file"
                        ? Math.round((item as BoxFile).size / 1024) + " KB"
                        : `${(item as BoxFolder).item_count} items`}
                    </TableCell>
                    <TableCell>
                      {format(new Date(item.modified_at), "PP")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
}