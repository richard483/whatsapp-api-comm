@Library('global-pipeline') _

// KubePipeline() {
// 	dockerImage = "karasu-bot:latest"
// 	projectName = "karasu-bot"
//   externalEndpointsIp = "10.10.10.22"
//   appPort = "80"
// }

GlobalPipeline() {
  dockerImage = 'karasu-bot:latest'         // required
  projectName = 'karasu-bot'                      // required (container/service name)
  externalEndpointsIp = "10.10.10.22"
  appPort = '80'                            // optional
  volumeDriver = '/etc/karasu-bot/auth_info_baileys:/app/auth_info_baileys'  
  buildArgs = [
    DB_HOST: '222.222.1.103:5432',
    DB_USER:'karasu',
    DB_PASSWORD:'124rasun0_092025',
    DB_NAME:'karasu',
    WA_NUMBER:'6285831601962'

  ]
}