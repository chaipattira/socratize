-- CreateTable
CREATE TABLE "Sandbox" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "skillFolderPaths" TEXT NOT NULL,
    "workspaceFolderPath" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SandboxMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sandboxId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SandboxMessage_sandboxId_fkey" FOREIGN KEY ("sandboxId") REFERENCES "Sandbox" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SandboxMessage_sandboxId_idx" ON "SandboxMessage"("sandboxId");
