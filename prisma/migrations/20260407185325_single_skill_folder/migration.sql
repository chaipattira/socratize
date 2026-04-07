/*
  Warnings:

  - You are about to drop the column `skillFolderPaths` on the `Sandbox` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Sandbox" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "skillFolderPath" TEXT NOT NULL DEFAULT '',
    "workspaceFolderPath" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Sandbox" ("createdAt", "id", "name", "updatedAt", "workspaceFolderPath") SELECT "createdAt", "id", "name", "updatedAt", "workspaceFolderPath" FROM "Sandbox";
DROP TABLE "Sandbox";
ALTER TABLE "new_Sandbox" RENAME TO "Sandbox";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
