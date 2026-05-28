// ═══════════════════════════════════════════════════════════════════════════════
// KQL Service - Azure Application Insights Query Execution
// Executes KQL queries against Azure App Insights and returns formatted results
// ═══════════════════════════════════════════════════════════════════════════════

const axios = require('axios');

class KqlService {
  constructor() {
    this.appId = process.env.APP_INSIGHTS_APP_ID;
    this.apiKey = process.env.APP_INSIGHTS_API_KEY;
    this.baseUrl = 'https://api.applicationinsights.io/v1/apps';
    this.queryTimeout = 30000; // 30 seconds
    this.maxRetries = 2;
  }

  /**
   * Execute a KQL query against Application Insights
   */
  async executeQuery(query, timespan = 'PT1H') {
    if (!this.appId || !this.apiKey) {
      throw new Error('Application Insights credentials not configured');
    }

    // Validate query
    this.validateQuery(query);

    const startTime = Date.now();

    try {
      const response = await axios.post(
        `${this.baseUrl}/${this.appId}/query`,
        {
          query: query,
          timespan: timespan
        },
        {
          headers: {
            'x-api-key': this.apiKey,
            'Content-Type': 'application/json'
          },
          timeout: this.queryTimeout
        }
      );

      const executionTime = Date.now() - startTime;

      return this.formatResponse(response.data, executionTime);

    } catch (error) {
      console.error('KQL query execution error:', error.message);
      
      if (error.code === 'ECONNABORTED') {
        throw new Error(`Query timeout: Execution exceeded ${this.queryTimeout / 1000} seconds`);
      }

      if (error.response) {
        const errorMsg = error.response.data?.error?.message || error.response.data?.message || 'Query execution failed';
        throw new Error(`Azure API Error: ${errorMsg}`);
      }

      throw new Error(`Query failed: ${error.message}`);
    }
  }

  /**
   * Execute multiple queries in parallel for comparison
   */
  async executeMultipleQueries(queries, timespan = 'PT1H') {
    const promises = queries.map(async (queryConfig) => {
      try {
        const result = await this.executeQuery(queryConfig.kql, timespan);
        return {
          id: queryConfig.id,
          label: queryConfig.label,
          color: queryConfig.color,
          success: true,
          data: result
        };
      } catch (error) {
        return {
          id: queryConfig.id,
          label: queryConfig.label,
          color: queryConfig.color,
          success: false,
          error: error.message
        };
      }
    });

    const results = await Promise.all(promises);
    
    return {
      success: true,
      queries: results,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Format Azure API response to standard format
   */
  formatResponse(data, executionTime) {
    if (!data.tables || data.tables.length === 0) {
      return {
        success: true,
        tables: [],
        rowCount: 0,
        executionTime
      };
    }

    const tables = data.tables.map(table => ({
      name: table.name,
      columns: table.columns.map(col => ({
        name: col.name,
        type: col.type
      })),
      rows: table.rows,
      rowCount: table.rows.length
    }));

    return {
      success: true,
      tables,
      rowCount: tables.reduce((sum, t) => sum + t.rowCount, 0),
      executionTime
    };
  }

  /**
   * Validate KQL query for safety
   */
  validateQuery(query) {
    if (!query || typeof query !== 'string') {
      throw new Error('Query must be a non-empty string');
    }

    const trimmed = query.trim();
    if (trimmed.length === 0) {
      throw new Error('Query cannot be empty');
    }

    // Check for extremely long queries
    if (trimmed.length > 50000) {
      throw new Error('Query is too long (max 50,000 characters)');
    }

    // Basic validation - KQL should start with a table name or 'let'
    const validStarts = ['requests', 'dependencies', 'exceptions', 'traces', 'customEvents', 
                         'pageViews', 'availabilityResults', 'customMetrics', 'let', 'union', 
                         'print', 'range'];
    
    const firstWord = trimmed.split(/\s+/)[0].toLowerCase();
    const isValid = validStarts.some(start => firstWord.startsWith(start));

    if (!isValid) {
      console.warn(`Query starts with unexpected keyword: ${firstWord}`);
      // Don't throw - allow it but log warning
    }
  }

  /**
   * Get available tables/schemas
   */
  async getSchema() {
    if (!this.appId || !this.apiKey) {
      throw new Error('Application Insights credentials not configured');
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/${this.appId}/metadata`,
        {
          headers: {
            'x-api-key': this.apiKey
          },
          timeout: 10000
        }
      );

      return {
        success: true,
        tables: response.data.tables || [],
        functions: response.data.functions || []
      };

    } catch (error) {
      console.error('Failed to fetch schema:', error.message);
      throw new Error('Failed to fetch Application Insights schema');
    }
  }

  /**
   * Test connection to Application Insights
   */
  async testConnection() {
    try {
      // Simple query to test connection
      const result = await this.executeQuery('requests | take 1', 'PT1M');
      return {
        success: true,
        message: 'Connection successful',
        appId: this.appId
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Get query suggestions based on common patterns
   */
  getQuerySuggestions() {
    return [
      {
        category: 'Requests',
        queries: [
          {
            name: 'Request Rate',
            kql: 'requests\n| summarize count() by bin(timestamp, 5m)\n| order by timestamp desc'
          },
          {
            name: 'Failed Requests',
            kql: 'requests\n| where success == false\n| summarize count() by name, resultCode\n| order by count_ desc'
          },
          {
            name: 'Response Time Percentiles',
            kql: 'requests\n| summarize percentiles(duration, 50, 90, 95, 99) by bin(timestamp, 5m)'
          }
        ]
      },
      {
        category: 'Dependencies',
        queries: [
          {
            name: 'Dependency Calls',
            kql: 'dependencies\n| summarize count() by type, target\n| order by count_ desc'
          },
          {
            name: 'Slow Dependencies',
            kql: 'dependencies\n| where duration > 1000\n| summarize count(), avg(duration) by name\n| order by count_ desc'
          }
        ]
      },
      {
        category: 'Exceptions',
        queries: [
          {
            name: 'Exception Count',
            kql: 'exceptions\n| summarize count() by type, outerMessage\n| order by count_ desc'
          },
          {
            name: 'Exception Timeline',
            kql: 'exceptions\n| summarize count() by bin(timestamp, 1h)\n| order by timestamp desc'
          }
        ]
      }
    ];
  }
}

// Singleton instance
const kqlService = new KqlService();

module.exports = kqlService;
