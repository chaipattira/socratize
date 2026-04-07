-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "docOps" TEXT,
    "toolHistory" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "SessionConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Message" ("content", "conversationId", "createdAt", "docOps", "id", "role", "toolHistory") SELECT "content", "conversationId", "createdAt", "docOps", "id", "role", "toolHistory" FROM "Message";
DROP TABLE "Message";
ALTER TABLE "new_Message" RENAME TO "Message";
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");
CREATE TABLE "new_SandboxMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolHistory" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SandboxMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "SandboxConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SandboxMessage" ("content", "conversationId", "createdAt", "id", "role", "toolHistory") SELECT "content", "conversationId", "createdAt", "id", "role", "toolHistory" FROM "SandboxMessage";
DROP TABLE "SandboxMessage";
ALTER TABLE "new_SandboxMessage" RENAME TO "SandboxMessage";
CREATE INDEX "SandboxMessage_conversationId_idx" ON "SandboxMessage"("conversationId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
