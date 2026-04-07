-- CreateTable
CREATE TABLE "SessionConversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New conversation',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SessionConversation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SandboxConversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sandboxId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New conversation',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SandboxConversation_sandboxId_fkey" FOREIGN KEY ("sandboxId") REFERENCES "Sandbox" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chatSessionId" TEXT,
    "conversationId" TEXT,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "docOps" TEXT,
    "toolHistory" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_chatSessionId_fkey" FOREIGN KEY ("chatSessionId") REFERENCES "ChatSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "SessionConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Message" ("chatSessionId", "content", "createdAt", "docOps", "id", "role", "toolHistory") SELECT "chatSessionId", "content", "createdAt", "docOps", "id", "role", "toolHistory" FROM "Message";
DROP TABLE "Message";
ALTER TABLE "new_Message" RENAME TO "Message";
CREATE INDEX "Message_chatSessionId_idx" ON "Message"("chatSessionId");
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");
CREATE TABLE "new_SandboxMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sandboxId" TEXT,
    "conversationId" TEXT,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolHistory" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SandboxMessage_sandboxId_fkey" FOREIGN KEY ("sandboxId") REFERENCES "Sandbox" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SandboxMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "SandboxConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SandboxMessage" ("content", "createdAt", "id", "role", "sandboxId", "toolHistory") SELECT "content", "createdAt", "id", "role", "sandboxId", "toolHistory" FROM "SandboxMessage";
DROP TABLE "SandboxMessage";
ALTER TABLE "new_SandboxMessage" RENAME TO "SandboxMessage";
CREATE INDEX "SandboxMessage_sandboxId_idx" ON "SandboxMessage"("sandboxId");
CREATE INDEX "SandboxMessage_conversationId_idx" ON "SandboxMessage"("conversationId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "SessionConversation_sessionId_idx" ON "SessionConversation"("sessionId");

-- CreateIndex
CREATE INDEX "SandboxConversation_sandboxId_idx" ON "SandboxConversation"("sandboxId");
