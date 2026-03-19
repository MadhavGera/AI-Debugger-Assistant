// MongoDB initialization script
// Runs on first container startup

db = db.getSiblingDB('ai-debugger');

// Create indexes for performance
db.users.createIndex({ githubId: 1 }, { unique: true });
db.users.createIndex({ login: 1 });

db.repositories.createIndex({ userId: 1 });
db.repositories.createIndex({ githubId: 1, userId: 1 }, { unique: true });
db.repositories.createIndex({ isIndexed: 1, userId: 1 });

db.analyses.createIndex({ repositoryId: 1, userId: 1 });
db.analyses.createIndex({ createdAt: -1 });
db.analyses.createIndex({ userId: 1, createdAt: -1 });

db.pullrequests.createIndex({ repositoryId: 1, userId: 1 });
db.pullrequests.createIndex({ status: 1, userId: 1 });

// Create app user with limited permissions
db.createUser({
  user: 'ai_debugger_app',
  pwd: process.env.APP_DB_PASSWORD || 'changeme',
  roles: [
    {
      role: 'readWrite',
      db: 'ai-debugger',
    },
  ],
});

print('MongoDB initialized successfully');
