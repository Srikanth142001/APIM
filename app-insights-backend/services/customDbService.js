// ═══════════════════════════════════════════════════════════════════════════════
// Custom Database Service - PostgreSQL Connection Pool Manager
// Manages user-configured database connections with safety features
// ═══════════════════════════════════════════════════════════════════════════════

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Persistence file path
const STORAGE_DIR = '/app/shared';
const CONNECTIONS_FILE = path.join(STORAGE_DIR, 'db-connections.json');

class CustomDbService {
  constructor() {
    // Store connection pools by connection ID
    this.pools = new Map();
    
    // Store connection configurations (encrypted credentials)
    this.connections = new Map();
    
    // Query timeout (prevent long-running queries)
    this.queryTimeout = 30000; // 30 seconds
    
    // Max connections per pool (prevent connection exhaustion)
    this.maxPoolSize = 5;
    
    // Load saved connections on startup
    this.loadConnections();
  }

  /**
   * Load connections from file
   */
  loadConnections() {
    try {
      if (fs.existsSync(CONNECTIONS_FILE)) {
        const data = fs.readFileSync(CONNECTIONS_FILE, 'utf8');
        const saved = JSON.parse(data);
        
        // Restore connections (but not pools - those will be created on first use)
        for (const [id, config] of Object.entries(saved)) {
          this.connections.set(id, {
            ...config,
            createdAt: new Date(config.createdAt),
            lastUsed: new Date(config.lastUsed)
          });
        }
        
        console.log(`✅ Loaded ${this.connections.size} saved database connections`);
      }
    } catch (error) {
      console.error('⚠️  Failed to load saved connections:', error.message);
    }
  }

  /**
   * Save connections to file
   */
  saveConnections() {
    try {
      // Ensure directory exists
      if (!fs.existsSync(STORAGE_DIR)) {
        fs.mkdirSync(STORAGE_DIR, { recursive: true });
      }

      // Convert Map to object for JSON serialization
      const data = {};
      for (const [id, config] of this.connections.entries()) {
        data[id] = config;
      }

      fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify(data, null, 2), 'utf8');
      console.log(`💾 Saved ${this.connections.size} database connections`);
    } catch (error) {
      console.error('⚠️  Failed to save connections:', error.message);
    }
  }

  /**
   * Create or update a database connection
   */
  async createConnection(connectionId, config) {
    try {
      // Validate configuration
      this.validateConfig(config);

      // Close existing pool if exists
      if (this.pools.has(connectionId)) {
        await this.closeConnection(connectionId);
      }

      // Create connection pool with safety settings
      const pool = new Pool({
        host: config.host,
        port: config.port || 5432,
        database: config.database,
        user: config.username,
        password: config.password,
        
        // Connection pool settings
        max: this.maxPoolSize, // Maximum pool size
        min: 1, // Minimum pool size
        idleTimeoutMillis: 30000, // Close idle connections after 30s
        connectionTimeoutMillis: 10000, // Connection timeout 10s
        
        // SSL settings (optional)
        ssl: config.ssl ? { rejectUnauthorized: false } : false,
        
        // Statement timeout (prevent long queries)
        statement_timeout: this.queryTimeout,
        
        // Query timeout
        query_timeout: this.queryTimeout,
        
        // Application name for tracking
        application_name: 'APIM_Dashboard_CustomQuery'
      });

      // Test connection
      const client = await pool.connect();
      
      // Set session to READ ONLY for safety
      await client.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY');
      
      client.release();

      // Store pool and config
      this.pools.set(connectionId, pool);
      this.connections.set(connectionId, {
        ...config,
        password: '***', // Don't store plain password
        createdAt: new Date(),
        lastUsed: new Date()
      });

      // Save to file
      this.saveConnections();

      console.log(`✅ Database connection created: ${connectionId}`);
      return { success: true, connectionId };

    } catch (error) {
      console.error(`❌ Failed to create connection ${connectionId}:`, error.message);
      throw new Error(`Connection failed: ${error.message}`);
    }
  }

  /**
   * Test database connection
   */
  async testConnection(config) {
    let testPool = null;
    try {
      testPool = new Pool({
        host: config.host,
        port: config.port || 5432,
        database: config.database,
        user: config.username,
        password: config.password,
        max: 1,
        connectionTimeoutMillis: 10000,
        ssl: config.ssl ? { rejectUnauthorized: false } : false
      });

      const client = await testPool.connect();
      const result = await client.query('SELECT version()');
      client.release();

      return {
        success: true,
        version: result.rows[0].version,
        message: 'Connection successful'
      };

    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    } finally {
      if (testPool) {
        await testPool.end();
      }
    }
  }

  /**
   * Execute a query with safety checks
   */
  async executeQuery(connectionId, query, params = []) {
    const pool = this.pools.get(connectionId);
    
    if (!pool) {
      throw new Error('Connection not found. Please create a connection first.');
    }

    // Validate query (basic safety checks)
    this.validateQuery(query);

    const startTime = Date.now();
    let client = null;

    try {
      client = await pool.connect();
      
      // Ensure READ ONLY mode
      await client.query('SET TRANSACTION READ ONLY');
      
      // Execute query with timeout
      const result = await client.query({
        text: query,
        values: params,
        rowMode: 'array' // More efficient for large results
      });

      const executionTime = Date.now() - startTime;

      // Update last used timestamp
      const connInfo = this.connections.get(connectionId);
      if (connInfo) {
        connInfo.lastUsed = new Date();
      }

      return {
        success: true,
        rows: result.rows,
        fields: result.fields.map(f => ({
          name: f.name,
          dataType: f.dataTypeID
        })),
        rowCount: result.rowCount,
        executionTime,
        command: result.command
      };

    } catch (error) {
      console.error(`Query execution error on ${connectionId}:`, error.message);
      
      // Check if it's a timeout error
      if (error.message.includes('timeout') || error.message.includes('canceling statement')) {
        throw new Error(`Query timeout: Execution exceeded ${this.queryTimeout / 1000} seconds`);
      }
      
      throw new Error(`Query failed: ${error.message}`);

    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Get list of tables in the database
   */
  async getTables(connectionId) {
    const query = `
      SELECT 
        schemaname as schema,
        tablename as table_name,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
      FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY schemaname, tablename
    `;

    try {
      const result = await this.executeQuery(connectionId, query);
      return {
        success: true,
        tables: result.rows.map(row => ({
          schema: row[0],
          name: row[1],
          size: row[2]
        }))
      };
    } catch (error) {
      throw new Error(`Failed to fetch tables: ${error.message}`);
    }
  }

  /**
   * Get table schema (columns)
   */
  async getTableSchema(connectionId, schemaName, tableName) {
    const query = `
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position
    `;

    try {
      const result = await this.executeQuery(connectionId, query, [schemaName, tableName]);
      return {
        success: true,
        columns: result.rows.map(row => ({
          name: row[0],
          type: row[1],
          nullable: row[2],
          default: row[3]
        }))
      };
    } catch (error) {
      throw new Error(`Failed to fetch table schema: ${error.message}`);
    }
  }

  /**
   * Close a specific connection
   */
  async closeConnection(connectionId) {
    const pool = this.pools.get(connectionId);
    if (pool) {
      await pool.end();
      this.pools.delete(connectionId);
      this.connections.delete(connectionId);
      
      // Save to file
      this.saveConnections();
      
      console.log(`🔌 Connection closed: ${connectionId}`);
      return { success: true };
    }
    return { success: false, message: 'Connection not found' };
  }

  /**
   * Get all active connections
   */
  getConnections() {
    const connections = [];
    for (const [id, config] of this.connections.entries()) {
      connections.push({
        id,
        name: config.name,
        host: config.host,
        port: config.port,
        database: config.database,
        username: config.username,
        createdAt: config.createdAt,
        lastUsed: config.lastUsed,
        isActive: this.pools.has(id)
      });
    }
    return connections;
  }

  /**
   * Validate connection configuration
   */
  validateConfig(config) {
    if (!config.host) throw new Error('Host is required');
    if (!config.database) throw new Error('Database name is required');
    if (!config.username) throw new Error('Username is required');
    // Password is optional (some databases allow passwordless connections)
    
    // Validate port
    const port = config.port || 5432;
    if (port < 1 || port > 65535) {
      throw new Error('Invalid port number');
    }
  }

  /**
   * Validate query for safety
   */
  validateQuery(query) {
    const normalizedQuery = query.trim().toUpperCase();
    
    // Block dangerous operations
    const dangerousKeywords = [
      'DROP', 'DELETE', 'TRUNCATE', 'INSERT', 'UPDATE',
      'ALTER', 'CREATE', 'GRANT', 'REVOKE', 'EXECUTE'
    ];

    for (const keyword of dangerousKeywords) {
      if (normalizedQuery.includes(keyword)) {
        throw new Error(`Query contains forbidden keyword: ${keyword}. Only SELECT queries are allowed.`);
      }
    }

    // Must start with SELECT or WITH (for CTEs)
    if (!normalizedQuery.startsWith('SELECT') && 
        !normalizedQuery.startsWith('WITH') &&
        !normalizedQuery.startsWith('EXPLAIN')) {
      throw new Error('Only SELECT, WITH, and EXPLAIN queries are allowed');
    }

    // Check for empty query
    if (query.trim().length === 0) {
      throw new Error('Query cannot be empty');
    }
  }

  /**
   * Close all connections (cleanup)
   */
  async closeAll() {
    console.log('🔌 Closing all database connections...');
    const promises = [];
    for (const [id] of this.pools.entries()) {
      promises.push(this.closeConnection(id));
    }
    await Promise.all(promises);
    console.log('✅ All connections closed');
  }
}

// Singleton instance
const customDbService = new CustomDbService();

// Cleanup on process exit
process.on('SIGINT', async () => {
  await customDbService.closeAll();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await customDbService.closeAll();
  process.exit(0);
});

module.exports = customDbService;
