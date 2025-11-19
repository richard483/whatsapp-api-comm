@Library('global-pipeline') _

// example configuration for a Docker-based pipeline

ScriptDockerPipeline() {
  dockerImage = 'karasu-bot:latest'
  projectName = 'karasu-bot'
  externalEndpointsIp = "10.10.10.22"
  appPort = '80'
  volumeDriver = '<volume-driver>'
  buildArgs = [
    DB_HOST: '<db-host>',
    DB_USER:'<db-user>',
    DB_PASSWORD:'<db-password>',
    DB_NAME:'<db-name>',
    WA_NUMBER:'<wa-number>'

  ]
  gitConfig = [
    repoUrl: 'https://github.com/richard483/whatsapp-bot.git',
    branch: '<branch-name>',
    credentialsId: '<git-credentials-id>'
  ]
}