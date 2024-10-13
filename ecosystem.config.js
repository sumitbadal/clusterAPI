module.exports = {
    apps: [
      {
        name: 'clusterApi',
        script: 'npm',
        args: 'start', // Command to run your "start" script defined in package.json
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '1G',
        env: {
          NODE_ENV: 'production'
        },
        // PM2 will execute the "build" script before running the "start" command
        post_deploy: 'npm install && npm run build'
      }
    ]
  };
  