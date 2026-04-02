-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ChatSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "llmProvider" TEXT NOT NULL DEFAULT 'anthropic',
    "model" TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
    "extractionMode" TEXT NOT NULL DEFAULT 'guided',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ChatSession" ("createdAt", "id", "llmProvider", "model", "title", "updatedAt") SELECT "createdAt", "id", "llmProvider", "model", "title", "updatedAt" FROM "ChatSession";
DROP TABLE "ChatSession";
ALTER TABLE "new_ChatSession" RENAME TO "ChatSession";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
