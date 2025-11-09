# Cloudflare Pages 部署清单

## 📁 需要的文件（仅2个）

```
cloudflare-pages-proxy
├── functions/
│   └── [[path]].js       ✅ 反向代理核心文件
└── _routes.json          ✅ 路由配置文件
```

---

## 🚀 部署步骤

### 方法1: 直接上传文件（推荐 - 最简单）

1. **登录 Cloudflare Dashboard**
   - 访问 https://dash.cloudflare.com
   - 点击左侧 **Workers & Pages**

2. **创建 Pages 项目**
   - 点击 **Create application**
   - 选择 **Pages** 标签
   - 点击 **Upload assets**

3. **上传文件**
   - 将这两个文件保持目录结构打包成 ZIP：
     ```
     your-upload.zip
     ├── functions/
     │   └── [[path]].js
     └── _routes.json
     ```
   - 上传 ZIP 文件
   - 项目名称：随便填（如 `your-project-proxy`）
   - 点击 **Deploy site**

4. **获取 URL**
   - 部署完成后会得到：`https://your-project-proxy.pages.dev`
   - 这就是您的反向代理地址！

---

## 🧪 测试部署

部署成功后测试：

```bash
# 测试健康检查
curl https://your-project-proxy.pages.dev/health

# 应该返回后端的健康检查响应
```

如果返回 404，检查：
1. `_routes.json` 是否存在
2. `functions/[[path]].js` 路径是否正确
3. Cloudflare Pages 项目的 Root directory 是否配置正确

---

## ⚙️ 配置后端地址

编辑 `functions/[[path]].js`，修改第17行：

```javascript
const CONFIG = {
  upstream: 'https://www.baidu.com',  // 改成您的后端地址
  // ...
};
```

每次修改后：
- **方法1（直接上传）**: 重新打包上传
- **方法2（GitHub）**: `git push` 自动部署
