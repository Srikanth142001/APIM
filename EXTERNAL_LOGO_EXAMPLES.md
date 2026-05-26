# 🖼️ Using External Logo URLs

## Yes, You Can Use External URLs!

The `PROJECT_LOGO` environment variable supports **both local paths and external URLs**.

---

## ✅ Supported Logo Types

### 1. **External URLs** (Easiest - No Setup Required)

```bash
docker run -d -p 8082:80 \
  -e PROJECT_LOGO="https://upload.wikimedia.org/wikipedia/commons/2/28/Cricket_Wireless_%282014%29.svg" \
  -e PROJECT_NAME="Cricket Wireless Dashboard" \
  -e APP_INSIGHTS_APP_ID=xxx \
  -e APP_INSIGHTS_API_KEY=xxx \
  -e JWT_SECRET=xxx \
  -e ADMIN_PASSWORD=xxx \
  reddy321678/apim:latest
```

**Supported formats:**
- ✅ SVG: `https://example.com/logo.svg`
- ✅ PNG: `https://example.com/logo.png`
- ✅ JPG: `https://example.com/logo.jpg`
- ✅ GIF: `https://example.com/logo.gif`
- ✅ WebP: `https://example.com/logo.webp`

### 2. **Local Paths** (Requires File in Container)

```bash
docker run -d -p 8082:80 \
  -e PROJECT_LOGO="/momo.png" \
  -e APP_INSIGHTS_APP_ID=xxx \
  ...
  reddy321678/apim:latest
```

---

## 📋 Real-World Examples

### Example 1: Wikipedia Logo (SVG)
```bash
-e PROJECT_LOGO="https://upload.wikimedia.org/wikipedia/commons/2/28/Cricket_Wireless_%282014%29.svg"
-e PROJECT_NAME="Cricket Wireless"
```

### Example 2: Company CDN Logo
```bash
-e PROJECT_LOGO="https://cdn.yourcompany.com/assets/logo.png"
-e PROJECT_NAME="Your Company"
```

### Example 3: GitHub Avatar
```bash
-e PROJECT_LOGO="https://avatars.githubusercontent.com/u/12345678"
-e PROJECT_NAME="My Project"
```

### Example 4: Imgur or Image Host
```bash
-e PROJECT_LOGO="https://i.imgur.com/abc123.png"
-e PROJECT_NAME="My Dashboard"
```

### Example 5: Azure Blob Storage
```bash
-e PROJECT_LOGO="https://mystorageaccount.blob.core.windows.net/logos/company-logo.png"
-e PROJECT_NAME="Azure Dashboard"
```

---

## 🚀 Complete Example with Cricket Wireless Logo

```bash
docker run -d -p 8082:80 \
  --name apim-cricket \
  -e PROJECT_NAME="Cricket Wireless API Monitor" \
  -e PROJECT_LOGO="https://upload.wikimedia.org/wikipedia/commons/2/28/Cricket_Wireless_%282014%29.svg" \
  -e TOP_APIS_LIMIT="20" \
  -e REACT_APP_REGION_NAME="US Production" \
  -e APP_INSIGHTS_APP_ID=your-app-id \
  -e APP_INSIGHTS_API_KEY=your-api-key \
  -e AZURE_SUBSCRIPTION_ID=your-subscription-id \
  -e AZURE_RESOURCE_GROUP=your-resource-group \
  -e AKS_CLUSTER_NAME=your-aks-cluster \
  -e MYSQL_SERVER_NAME=your-mysql-server \
  -e LOG_ANALYTICS_WORKSPACE_ID=your-workspace-id \
  -e LOG_ANALYTICS_AUTH_TOKEN=your-token \
  -e JWT_SECRET=your-jwt-secret-minimum-32-characters \
  -e ADMIN_USERNAME=admin \
  -e ADMIN_PASSWORD=your-secure-password \
  -e ENABLE_ML_ALERTS=true \
  -e ENABLE_OUTAGE_DETECTION=true \
  reddy321678/apim:latest
```

---

## 🔧 How It Works

1. **Container starts**
2. **Entrypoint script reads** `PROJECT_LOGO` environment variable
3. **Writes to config.js:**
   ```javascript
   window.ENV_CONFIG = {
     PROJECT_LOGO: 'https://upload.wikimedia.org/wikipedia/commons/2/28/Cricket_Wireless_%282014%29.svg',
     ...
   };
   ```
4. **Frontend loads** and uses the URL directly in `<img>` tags
5. **Browser fetches** the logo from the external URL

---

## ✅ Advantages of External URLs

| Feature | External URL | Local File |
|---------|--------------|------------|
| **No file management** | ✅ Yes | ❌ No - must add to image |
| **Easy to change** | ✅ Yes - just restart | ❌ No - must rebuild |
| **CDN benefits** | ✅ Yes - fast loading | ❌ No |
| **Version control** | ✅ Yes - update at source | ❌ No - rebuild needed |
| **Multiple deployments** | ✅ Yes - different URLs | ⚠️ Limited |

---

## ⚠️ Important Considerations

### CORS (Cross-Origin Resource Sharing)
- Most public CDNs and image hosts support CORS
- Wikipedia, Imgur, GitHub, etc. work fine
- If logo doesn't load, check browser console for CORS errors

### HTTPS Required
- Use `https://` URLs (not `http://`)
- Mixed content warnings if using HTTP logo on HTTPS site

### Logo Availability
- External URL must be publicly accessible
- Logo host must be reliable (uptime)
- Consider using a CDN for production

### Performance
- External URLs may be slower on first load
- Browser caches the image after first load
- CDN-hosted logos are usually very fast

---

## 🧪 Testing

### Test with Cricket Wireless Logo
```bash
# Build image
docker build -f Dockerfile.combined.ci -t reddy321678/apim:latest .

# Run with Cricket logo
docker run -d -p 8082:80 \
  -e PROJECT_NAME="Cricket Wireless" \
  -e PROJECT_LOGO="https://upload.wikimedia.org/wikipedia/commons/2/28/Cricket_Wireless_%282014%29.svg" \
  -e APP_INSIGHTS_APP_ID=test \
  -e APP_INSIGHTS_API_KEY=test \
  -e JWT_SECRET=test-secret-minimum-32-characters \
  -e ADMIN_PASSWORD=test123 \
  reddy321678/apim:latest

# Check logs
docker logs <container-id>

# Should show:
# ✅ Frontend config.js written
#    Project: Cricket Wireless
#    Logo: https://upload.wikimedia.org/wikipedia/commons/2/28/Cricket_Wireless_%282014%29.svg
```

### Verify in Browser
1. Open `http://localhost:8082`
2. Open browser DevTools (F12)
3. Go to Network tab
4. Look for the logo URL being fetched
5. Check Console for any CORS errors

### Verify config.js
```bash
docker exec <container-id> cat /usr/share/nginx/html/config.js
```

Should show:
```javascript
window.ENV_CONFIG = {
  API_PROTOCOL: 'http',
  API_HOSTNAME: '',
  API_PORT: '',
  REGION_NAME: 'SAN Region',
  PROJECT_NAME: 'Cricket Wireless',
  PROJECT_LOGO: 'https://upload.wikimedia.org/wikipedia/commons/2/28/Cricket_Wireless_%282014%29.svg',
  TOP_APIS_LIMIT: '10'
};
```

---

## 🎨 Logo Recommendations

### Best Practices
- ✅ Use SVG for scalability (looks good at any size)
- ✅ Use transparent background (PNG or SVG)
- ✅ Keep file size small (<100KB)
- ✅ Use square or horizontal logos (not vertical)
- ✅ Test on both light and dark themes

### Recommended Sizes
- **Minimum:** 200x200px
- **Recommended:** 400x400px or 800x200px
- **Maximum:** 1000x1000px (larger = slower load)

### Recommended Formats
1. **SVG** - Best for logos (scalable, small file size)
2. **PNG** - Good for photos/complex images (supports transparency)
3. **WebP** - Modern format (small size, good quality)
4. **JPG** - Avoid (no transparency)

---

## 📝 Docker Compose Example

```yaml
version: '3.8'

services:
  apim-cricket:
    image: reddy321678/apim:latest
    container_name: apim-cricket
    ports:
      - "8082:80"
    environment:
      # Branding with External Logo
      PROJECT_NAME: "Cricket Wireless API Monitor"
      PROJECT_LOGO: "https://upload.wikimedia.org/wikipedia/commons/2/28/Cricket_Wireless_%282014%29.svg"
      TOP_APIS_LIMIT: "20"
      
      # Other config...
      REACT_APP_REGION_NAME: "US Production"
      APP_INSIGHTS_APP_ID: ${APP_INSIGHTS_APP_ID}
      APP_INSIGHTS_API_KEY: ${APP_INSIGHTS_API_KEY}
      AZURE_SUBSCRIPTION_ID: ${AZURE_SUBSCRIPTION_ID}
      AZURE_RESOURCE_GROUP: ${AZURE_RESOURCE_GROUP}
      JWT_SECRET: ${JWT_SECRET}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD}
    restart: unless-stopped
```

---

## 🔄 Switching Between Logos

### Change Logo Without Rebuild
```bash
# Stop current container
docker stop <container-id>
docker rm <container-id>

# Start with new logo
docker run -d -p 8082:80 \
  -e PROJECT_LOGO="https://example.com/new-logo.png" \
  ...
  reddy321678/apim:latest
```

### Multiple Deployments with Different Logos
```bash
# Customer A
docker run -d -p 8082:80 \
  -e PROJECT_NAME="Customer A" \
  -e PROJECT_LOGO="https://cdn.customera.com/logo.png" \
  ...

# Customer B
docker run -d -p 8083:80 \
  -e PROJECT_NAME="Customer B" \
  -e PROJECT_LOGO="https://cdn.customerb.com/logo.svg" \
  ...
```

---

## ❓ FAQ

**Q: Can I use any image URL from the internet?**  
A: Yes, as long as it's publicly accessible and supports CORS.

**Q: Will the logo work if the external site is down?**  
A: No, the logo won't load if the external URL is unavailable. Use reliable hosts.

**Q: Can I use a logo from my private network?**  
A: Yes, but the URL must be accessible from the user's browser (not just the container).

**Q: Does the logo URL need to be HTTPS?**  
A: Recommended for security and to avoid mixed content warnings.

**Q: Can I use data URLs (base64 encoded images)?**  
A: Yes! Example: `PROJECT_LOGO="data:image/png;base64,iVBORw0KGgo..."`

**Q: What if the logo is too big or too small?**  
A: The frontend CSS should handle sizing. If not, you may need to adjust the image at the source.

---

## 🎉 Summary

**Yes, you can use external URLs!**

```bash
# Just set the full URL
-e PROJECT_LOGO="https://upload.wikimedia.org/wikipedia/commons/2/28/Cricket_Wireless_%282014%29.svg"
```

**No additional setup required!** 🚀

The system automatically detects if it's a URL (starts with `http://` or `https://`) and uses it directly.

