# Nginx Blue-Green Deployment Configuration

## Overview

This directory contains the Nginx configuration for IHUI-AI blue-green deployment. It defines two upstream groups (blue / green) and routes traffic to the active environment. Switching is done by modifying the `proxy_pass` target and reloading Nginx — no downtime.

## Port Mapping

| Environment | Web Port | API Port |
| ----------- | -------- | -------- |
| Blue        | 3000     | 8080     |
| Green       | 3001     | 8081     |

## Files

| File                    | Description                                      |
| ----------------------- | ------------------------------------------------ |
| `nginx-blue-green.conf` | Main Nginx config with both upstreams and server |

## Manual Blue-Green Switch

### Switch to Green

```bash
# 1. Edit the config: change blue_web → green_web, blue_api → green_api
sed -i 's/blue_web/green_web/g; s/blue_api/green_api/g' /etc/nginx/conf.d/nginx-blue-green.conf

# 2. Test and reload
nginx -t && nginx -s reload
```

### Switch back to Blue

```bash
sed -i 's/green_web/blue_web/g; s/green_api/blue_api/g' /etc/nginx/conf.d/nginx-blue-green.conf
nginx -t && nginx -s reload
```

## GitHub Actions Workflow Integration

The workflow (`.github/workflows/blue-green-deploy.yml`) switches environments by copying an upstream pointer file to `/etc/nginx/conf.d/ihui-upstream.conf`. To use this approach instead of editing `proxy_pass` directly:

### 1. Create pointer files

Create `upstream-blue.conf`:

```nginx
upstream active_web { server 127.0.0.1:3000 max_fails=3 fail_timeout=30s; }
upstream active_api { server 127.0.0.1:8080 max_fails=3 fail_timeout=30s; }
```

Create `upstream-green.conf`:

```nginx
upstream active_web { server 127.0.0.1:8843 max_fails=3 fail_timeout=30s; }
upstream active_api { server 127.0.0.1:8844 max_fails=3 fail_timeout=30s; }
```

### 2. Update main config to use include

In `nginx-blue-green.conf`, replace the `proxy_pass` upstream names with `active_web` / `active_api`:

```nginx
location /api/ {
    proxy_pass http://active_api;
    ...
}
location / {
    proxy_pass http://active_web;
    ...
}
```

### 3. Deploy pointer files to server

```bash
# On the deploy server
cp upstream-blue.conf /opt/ihui/nginx/
cp upstream-green.conf /opt/ihui/nginx/

# Activate blue (default)
cp /opt/ihui/nginx/upstream-blue.conf /etc/nginx/conf.d/ihui-upstream.conf
nginx -t && nginx -s reload
```

The workflow will automatically copy the correct pointer file during deployment.

## Health Check

- **Nginx self-check:** `GET /nginx-health` returns `200 ok`
- **Upstream passive check:** `max_fails=3 fail_timeout=30s` — after 3 failures within 30s, the upstream server is marked unavailable for 30s

## SSL Configuration

Replace the placeholder paths with real certificate files:

```nginx
ssl_certificate     /etc/nginx/ssl/your-domain.crt;
ssl_certificate_key /etc/nginx/ssl/your-domain.key;
```

For Let's Encrypt:

```bash
certbot --nginx -d your-domain.com
```

## Deployment Steps

1. Copy `nginx-blue-green.conf` to `/etc/nginx/conf.d/` on the deploy server
2. Place SSL certificates at the configured paths
3. Test: `nginx -t`
4. Reload: `nginx -s reload`
5. Verify: `curl https://your-domain.com/nginx-health`
