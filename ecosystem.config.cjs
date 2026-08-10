module.exports = {
  apps: [
    {
      name: "tax-solo-engineer",
      cwd: __dirname,
      script: "./node_modules/.bin/next",
      args: "start -H 127.0.0.1 -p 3003",
      interpreter: "none",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      max_restarts: 10,
      min_uptime: "30s",
      kill_timeout: 5000,
      env: {
        NODE_ENV: "production",
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
      error_file: "/home/ubuntu/.pm2/logs/tax-solo-engineer-error.log",
      out_file: "/home/ubuntu/.pm2/logs/tax-solo-engineer-out.log",
    },
  ],
};
