# 🗄️ Custom Database Query Feature

## Overview

The Custom Database Query feature allows users to connect to PostgreSQL databases through the UI and execute custom SELECT queries safely. This feature is designed with multiple safety layers to protect production databases from accidental modifications or performance issues.

---

## 🔒 Safety Features

### 1. **Read-Only Mode**
- All connections are set to `READ ONLY` transaction mode
- Database-level protection against any write operations

### 2. **Query Validation**
- Only `SELECT`, `WITH` (CTEs), and `EXPLAIN` queries allowed
- Blocks: `INSERT`, `UPDATE`, `DELETE`, `DROP`, `TRUNCATE`, `ALTER`, `CREATE`, `GRANT`, `REVOKE`
- Server-side validation before execution

### 3. **Connection Pooling**
- Maximum 5 connections per database
- Prevents connection exhaustion
- Automatic connection cleanup after 30 seconds of inactivity
- No multiple connections to same database

### 4. **Query Timeout**
- 30-second timeout for all queries
- Prevents long-running queries from blocking resources
- Automatic query cancellation on timeout

### 5. **No Database Locking**
- Read-only mode prevents any locks
- Connection pool limits prevent resource exhaustion
- Safe for production database queries

---

## 📋 Features

### Connection Management
- ✅ Create multiple database connections
- ✅ Test connection before saving
- ✅ View all active connections
- ✅ Delete connections when no longer needed
- ✅ SSL support for secure connections

### Query Execution
- ✅ SQL syntax highlighting (monospace font)
- ✅ Execute custom SELECT queries
- ✅ View query results in table format
- ✅ Execution time tracking
- ✅ Row count display

### Database Explorer
- ✅ Browse all tables in database
- ✅ View table schemas
- ✅ Click table to generate sample query
- ✅ See table sizes

---

## 🚀 How to Use

### Step 1: Create a Connection

1. Click **"+ New Connection"** button
2. Fill in connection details:
   - **Connection Name**: Friendly name (e.g., "Production DB")
   - **Host**: Database server hostname or IP
   - **Port**: PostgreSQL port (default: 5432)
   - **Database**: Database name
   - **Username**: Database user
   - **Password**: Database password
   - **SSL**: Enable if required

3. Click **"🔌 Test Connection"** to verify
4. Click **"💾 Save Connection"** to save

### Step 2: Select a Connection

- Click on a saved connection in the left sidebar
- Connection will be highlighted in blue
- Tables will load automatically

### Step 3: Write and Execute Query

1. **Option A**: Click on a table name to generate sample query
2. **Option B**: Write your own SELECT query in the editor

3. Click **"▶ Execute Query"** button

4. View results:
   - Table with all columns and rows
   - Row count
   - Execution time in milliseconds

---

## 📝 Example Queries

### Basic SELECT
```sql
SELECT * FROM users LIMIT 100;
```

### With WHERE Clause
```sql
SELECT id, name, email, created_at 
FROM users 
WHERE created_at > '2024-01-01'
ORDER BY created_at DESC
LIMIT 50;
```

### JOIN Query
```sql
SELECT 
  o.id,
  o.order_date,
  u.name as customer_name,
  o.total_amount
FROM orders o
JOIN users u ON o.user_id = u.id
WHERE o.order_date > CURRENT_DATE - INTERVAL '7 days'
ORDER BY o.order_date DESC;
```

### Aggregation
```sql
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_orders,
  SUM(amount) as total_revenue
FROM orders
WHERE created_at > CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Common Table Expression (CTE)
```sql
WITH recent_orders AS (
  SELECT user_id, COUNT(*) as order_count
  FROM orders
  WHERE created_at > CURRENT_DATE - INTERVAL '30 days'
  GROUP BY user_id
)
SELECT 
  u.name,
  u.email,
  ro.order_count
FROM users u
JOIN recent_orders ro ON u.id = ro.user_id
WHERE ro.order_count > 5
ORDER BY ro.order_count DESC;
```

---

## ⚠️ Limitations

### Allowed Operations
- ✅ `SELECT` - Read data
- ✅ `WITH` - Common Table Expressions
- ✅ `EXPLAIN` - Query execution plans

### Blocked Operations
- ❌ `INSERT` - Cannot add data
- ❌ `UPDATE` - Cannot modify data
- ❌ `DELETE` - Cannot remove data
- ❌ `DROP` - Cannot drop tables/databases
- ❌ `TRUNCATE` - Cannot truncate tables
- ❌ `ALTER` - Cannot alter schema
- ❌ `CREATE` - Cannot create objects
- ❌ `GRANT/REVOKE` - Cannot change permissions

### Other Limits
- ⏱️ 30-second query timeout
- 🔌 Maximum 5 connections per database
- 📊 Results displayed in browser (large result sets may be slow)

---

## 🔧 Backend API Endpoints

### Test Connection
```http
POST /api/custom-db/test-connection
Content-Type: application/json

{
  "host": "localhost",
  "port": 5432,
  "database": "mydb",
  "username": "postgres",
  "password": "password",
  "ssl": false
}
```

### Create Connection
```http
POST /api/custom-db/connections
Content-Type: application/json

{
  "id": "conn_123",
  "name": "Production DB",
  "host": "prod-db.example.com",
  "port": 5432,
  "database": "production",
  "username": "readonly_user",
  "password": "secure_password",
  "ssl": true
}
```

### Get All Connections
```http
GET /api/custom-db/connections
```

### Delete Connection
```http
DELETE /api/custom-db/connections/{connectionId}
```

### Execute Query
```http
POST /api/custom-db/query
Content-Type: application/json

{
  "connectionId": "conn_123",
  "query": "SELECT * FROM users LIMIT 10",
  "params": []
}
```

### Get Tables
```http
GET /api/custom-db/connections/{connectionId}/tables
```

### Get Table Schema
```http
GET /api/custom-db/connections/{connectionId}/tables/{schema}/{table}
```

---

## 🛡️ Security Best Practices

### 1. **Use Read-Only Database Users**
Create a dedicated read-only user for the dashboard:

```sql
-- Create read-only user
CREATE USER dashboard_readonly WITH PASSWORD 'secure_password';

-- Grant connect permission
GRANT CONNECT ON DATABASE your_database TO dashboard_readonly;

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO dashboard_readonly;

-- Grant SELECT on all tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO dashboard_readonly;

-- Grant SELECT on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT SELECT ON TABLES TO dashboard_readonly;
```

### 2. **Use SSL Connections**
Always enable SSL for production databases:
- Check the "Use SSL Connection" checkbox
- Ensure your PostgreSQL server has SSL enabled

### 3. **Network Security**
- Use firewall rules to restrict database access
- Use VPN or private networks when possible
- Don't expose database ports to public internet

### 4. **Credential Management**
- Use strong passwords
- Rotate credentials regularly
- Don't share connection credentials
- Consider using environment variables for sensitive data

### 5. **Monitor Query Activity**
- Review executed queries regularly
- Set up alerts for suspicious activity
- Monitor connection counts

---

## 🐛 Troubleshooting

### Connection Failed
**Problem**: Cannot connect to database

**Solutions**:
1. Verify hostname/IP is correct
2. Check port number (default: 5432)
3. Ensure database name is correct
4. Verify username and password
5. Check firewall rules
6. Verify PostgreSQL is running
7. Check if SSL is required

### Query Timeout
**Problem**: Query exceeds 30-second timeout

**Solutions**:
1. Add `LIMIT` clause to reduce result set
2. Add `WHERE` clause to filter data
3. Optimize query with indexes
4. Break complex query into smaller parts

### Permission Denied
**Problem**: User doesn't have permission

**Solutions**:
1. Grant SELECT permission to user
2. Check schema permissions
3. Verify user has CONNECT permission

### Too Many Connections
**Problem**: Connection pool exhausted

**Solutions**:
1. Close unused connections
2. Wait for idle connections to timeout
3. Restart the backend service

---

## 📊 Performance Tips

### 1. **Use LIMIT**
Always limit result sets:
```sql
SELECT * FROM large_table LIMIT 100;
```

### 2. **Filter Early**
Use WHERE clauses to reduce data:
```sql
SELECT * FROM orders 
WHERE created_at > CURRENT_DATE - INTERVAL '7 days'
LIMIT 100;
```

### 3. **Select Specific Columns**
Don't use `SELECT *` for large tables:
```sql
SELECT id, name, email FROM users LIMIT 100;
```

### 4. **Use Indexes**
Ensure your WHERE/JOIN columns are indexed

### 5. **Avoid Cartesian Products**
Always use proper JOIN conditions

---

## 🔄 Connection Lifecycle

1. **Create**: User creates connection through UI
2. **Pool**: Backend creates connection pool (max 5 connections)
3. **Execute**: Queries use connections from pool
4. **Idle**: Unused connections close after 30 seconds
5. **Delete**: User deletes connection, pool is closed

---

## 📦 Dependencies

### Backend
- `pg` (^8.11.3) - PostgreSQL client for Node.js

### Frontend
- `axios` - HTTP client
- `react` - UI framework
- `react-router-dom` - Routing

---

## 🚀 Deployment

### Docker Build
The `pg` package is already added to `package.json`. When you rebuild the Docker image, it will be installed automatically:

```bash
docker build -f Dockerfile.combined.ci -t reddy321678/apim:latest .
```

### Environment Variables
No additional environment variables needed. All configuration is done through the UI.

---

## 📝 Future Enhancements

Potential features for future versions:

- [ ] Export query results to CSV/Excel
- [ ] Save favorite queries
- [ ] Query history
- [ ] Multiple database type support (MySQL, SQL Server)
- [ ] Query result pagination
- [ ] Visual query builder
- [ ] Scheduled queries
- [ ] Query result caching
- [ ] Collaborative query sharing

---

## ❓ FAQ

**Q: Can I use this with MySQL?**  
A: Currently only PostgreSQL is supported. MySQL support can be added in future.

**Q: Will this slow down my production database?**  
A: No, with proper query limits and read-only mode, impact is minimal. Use LIMIT clauses and avoid full table scans.

**Q: Can I execute stored procedures?**  
A: No, only SELECT queries are allowed for safety.

**Q: How do I export query results?**  
A: Currently, you can copy-paste from the results table. Export feature coming in future version.

**Q: Can multiple users share connections?**  
A: Yes, connections are stored in backend memory and available to all authenticated users.

**Q: What happens if I restart the container?**  
A: Connections are stored in memory, so they will be lost on restart. You'll need to recreate them.

**Q: Can I save queries for later?**  
A: Not yet, but this feature is planned for a future release.

---

## 🎉 Summary

The Custom Database Query feature provides a safe, user-friendly way to query PostgreSQL databases directly from the dashboard. With multiple safety layers including read-only mode, query validation, connection pooling, and timeouts, you can confidently query production databases without risk of data modification or performance issues.

**Key Benefits:**
- ✅ No database locking
- ✅ Read-only protection
- ✅ Connection pooling
- ✅ Query timeout protection
- ✅ Easy to use UI
- ✅ No code changes needed

**Perfect for:**
- Ad-hoc data analysis
- Debugging production issues
- Generating custom reports
- Exploring database schema
- Testing query performance

