# 旅行纪念网页生成器

这是一个部署在 GitHub Pages 上的旅行纪念网页生成器。

目标流程：

```text
上传资料
填写文字
点击生成并发布
自动上传到 GitHub
得到客户网页链接
写入 NFC
```

## 在线入口

管理页：

```text
https://zhpnncjdsg.github.io/tibetan-trail-memory/admin.html
```

示例客户页：

```text
https://zhpnncjdsg.github.io/tibetan-trail-memory/customers/sample-tibet-2026/
```

## GitHub Pages 能不能直接保存上传文件？

不能。

GitHub Pages 只能托管静态文件，不能像后台系统一样接收上传并保存文件。

本项目的做法是：

1. `admin.html` 在浏览器里读取你上传的照片、视频、GPX。
2. 浏览器用你填写的 GitHub Token 调用 GitHub API。
3. GitHub API 把文件提交到仓库：

   ```text
   customers/trip-日期-随机编号/
   ```

4. GitHub Pages 自动把这个文件夹变成客户网页。

这样不需要收费服务，也不需要复杂后端。

## 仓库配置

当前固定使用：

```text
owner: zhpnncjdsg
repo: tibetan-trail-memory
branch: main
```

客户页面最终地址格式：

```text
https://zhpnncjdsg.github.io/tibetan-trail-memory/customers/客户文件夹名/index.html
```

示例：

```text
https://zhpnncjdsg.github.io/tibetan-trail-memory/customers/trip-20260614-a8f3c2/index.html
```

## 小白操作说明

### 第一步：创建 GitHub Fine-grained Token

GitHub 官方文档：

```text
https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
```

1. 打开 GitHub。
2. 点击右上角头像。
3. 进入 `Settings`。
4. 左侧进入 `Developer settings`。
5. 进入 `Personal access tokens`。
6. 选择 `Fine-grained tokens`。
7. 点击 `Generate new token`。
8. Token name 可填：

   ```text
   memory-page-generator
   ```

9. Expiration 建议选择一个明确日期，例如 90 天或 180 天。

### 第二步：Token 只选择当前仓库

1. Resource owner 选择：

   ```text
   zhpnncjdsg
   ```

2. Repository access 选择：

   ```text
   Only select repositories
   ```

3. Selected repositories 只选择：

   ```text
   tibetan-trail-memory
   ```

### 第三步：权限只开 Contents: Read and Write

1. 找到 `Repository permissions`。
2. 只设置：

   ```text
   Contents: Read and Write
   ```

3. 其他权限保持默认，不要额外打开。
4. 点击生成 token。
5. 复制 token。

注意：

- Token 只会保存在当前浏览器的 `localStorage`。
- Token 不会写入网页代码。
- Token 不会提交到 GitHub 仓库。
- 如果换电脑或换浏览器，需要重新粘贴一次 token。

### 第四步：粘贴 Token

1. 打开：

   ```text
   https://zhpnncjdsg.github.io/tibetan-trail-memory/admin.html
   ```

2. 在 `GitHub Fine-grained Token` 输入框里粘贴 token。
3. Owner、Repo、Branch、Pages 地址默认不用改。

### 第五步：点击连接测试

1. 点击：

   ```text
   连接测试
   ```

2. 正常结果应该类似：

   ```text
   ✅ Token已填写
   ✅ Token有效
   ✅ GitHub API连接成功
   ✅ 仓库存在
   ✅ Contents读取正常
   ✅ Contents: Read and Write 权限正常
   ✅ 能创建测试文件
   ✅ Pages已开启
   ```

3. 如果看到 ❌，按页面显示的具体错误修改 token 或权限。

### 第六步：上传照片、视频、GPX

1. 上传客户照片，多张。
2. 上传客户视频，可选。
3. 上传 GPX 轨迹文件，可选。
4. 填写：

   - 客户名称
   - 页面标题
   - 副标题
   - 徒步地点
   - 徒步日期
   - 起点
   - 终点
   - 徒步距离
   - 最高海拔
   - 累计爬升
   - 页面风格
   - 定制说明

### 第七步：生成并发布

1. 点击：

   ```text
   生成并发布
   ```

2. 等待上传完成。
3. 成功后页面会显示最终客户链接。
4. 点击 `打开客户页` 可以预览。
5. 点击 `复制链接` 可以复制最终网址。

如果失败，页面会显示具体错误原因，不会只显示“失败”。

发布前页面会先显示：

```text
照片总大小
视频总大小
预计上传大小
```

如果 GitHub 返回 422，页面会显示具体是哪一个文件导致失败，例如：

```text
customers/trip-20260614-a8f3c2/photos/photo-03.jpg
大小：35.0 MB
```

### 第八步：把最终链接写入 NFC 芯片

1. 复制生成出来的客户链接。
2. 打开你的 NFC 写入工具。
3. 选择写入 URL/网址。
4. 粘贴客户链接。
5. 写入 NFC 芯片。
6. 用手机贴一下 NFC 测试是否能打开客户页面。

## 自动生成的路径

系统会自动生成安全英文路径，不使用中文路径。

格式：

```text
customers/trip-YYYYMMDD-随机编号/
```

例如：

```text
customers/trip-20260614-a8f3c2/
```

## 上传到 GitHub 的文件

每个客户会自动上传：

```text
customers/客户文件夹名/index.html
customers/客户文件夹名/data.json
customers/客户文件夹名/route.gpx
customers/客户文件夹名/photos/photo-01.jpg
customers/客户文件夹名/photos/photo-02.jpg
customers/客户文件夹名/videos/...
```

上传使用 GitHub Contents API：

```text
https://api.github.com/repos/{owner}/{repo}/contents/{path}
```

照片会在浏览器里自动压缩成适合手机网页浏览的 JPEG：

- 自动转 JPG
- 最大宽度 1920px
- 质量 80%

视频会在浏览器里自动压缩成适合手机 NFC 网页播放的 MP4：

- 最大 720p
- H.264 编码
- 24fps
- 码率约 1.5Mbps
- 目标尽量控制在 25MB 以下

压缩时页面会显示：

```text
正在压缩视频
压缩前大小
压缩后大小
正在上传
```

如果压缩后仍然超过 25MB，系统会提示：

```text
视频仍然过大，请缩短视频或降低清晰度。
```

如果当前浏览器不支持直接压缩为 MP4/H.264，页面会给出备用方案：

- 换新版 Safari 或 Chrome 再试
- 后续可接入 ffmpeg.wasm
- 或使用页面给出的本地 ffmpeg 压缩命令

GitHub 不适合放很大的视频文件，视频越短越稳定。

## 长期商用建议

当前最小可用版本使用：

```text
GitHub Pages + GitHub Contents API
```

它适合：

- 少量客户页面
- 每个客户约 15 张压缩照片
- 很短、很小的视频
- 免费试运营

它不适合：

- 很多客户长期累积
- 大量高清视频
- 需要更快的国内外访问速度
- 需要更稳定的商用素材存储

长期商用更推荐：

```text
GitHub Pages 负责网页
Cloudflare R2 负责照片和视频
```

原因：

- R2 更适合存放大量图片和视频
- GitHub 仓库不会越来越臃肿
- 客户页面仍然可以保持静态网页
- 不需要复杂后端
- 可以继续保留 NFC 链接流程

不建议长期只用 GitHub 仓库存所有客户照片和视频。GitHub 更适合放网页代码，不适合当大文件相册仓库。

## 路线动画

客户页使用：

- Leaflet.js
- OpenStreetMap

不使用收费 API。

支持：

- 读取 GPX
- 显示徒步路线
- 路线从起点逐渐画到终点
- 小圆点沿路线移动
- 起点和终点标记
- 点击按钮重播动画

## 注意事项

- 这个仓库是公开仓库，客户链接和图片理论上任何拿到链接的人都可以访问。
- 如果客户照片需要隐私保护，应改用私有存储或带权限的托管方案。
- GitHub Pages 在国内访问可能偏慢，NFC 可用，但速度取决于网络。
