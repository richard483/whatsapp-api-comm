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
  volumeDriver = '/etc/karasu-bot/auth_info_baileys:/app/auth_info_baileys'           // optional volume driver for container (example: '/var/lib/docker/volumes:my-volume/_data' on host)
}