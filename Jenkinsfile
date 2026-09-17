pipeline {
    agent any
    
    triggers {
        pollSCM('* * * * *')  // Poll every minute
    }
    
    environment {
        // Docker Hub (existing)
        DOCKERHUB_IMAGE = "reddy321678/apim"
        
        // Azure Container Registry — set ACR_LOGIN_SERVER in Jenkins env or here
        // e.g. yourregistry.azurecr.io
        ACR_LOGIN_SERVER = "${env.ACR_LOGIN_SERVER ?: 'yourregistry.azurecr.io'}"
        ACR_IMAGE        = "${ACR_LOGIN_SERVER}/apim"
        
        TAG          = "latest"
        HTTP_PROXY   = "http://192.168.1.70:3128"
        HTTPS_PROXY  = "http://192.168.1.70:3128"
    }
    
    stages {
        stage('Clone Repository') {
            steps {
                git branch: 'master',
                    credentialsId: 'git',
                    url: 'https://github.com/Srikanth142001/APIM.git'
            }
        }
        
        stage('Check Files') {
            steps {
                sh 'ls -lrt'
                sh 'ls -l Dockerfile.combined.ci'
            }
        }
        
        stage('Build Docker Image') {
            steps {
                script {
                    sh '''
                        docker build \
                          -f Dockerfile.combined.ci \
                          --build-arg http_proxy=$HTTP_PROXY \
                          --build-arg https_proxy=$HTTPS_PROXY \
                          --build-arg HTTP_PROXY=$HTTP_PROXY \
                          --build-arg HTTPS_PROXY=$HTTPS_PROXY \
                          -t $DOCKERHUB_IMAGE:$TAG \
                          -t $DOCKERHUB_IMAGE:build-${BUILD_NUMBER} \
                          -t $ACR_IMAGE:$TAG \
                          -t $ACR_IMAGE:build-${BUILD_NUMBER} \
                          .
                    '''
                }
            }
        }
        
        stage('Push to Docker Hub') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'docker',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    sh '''
                        echo $DOCKER_PASS | docker login -u $DOCKER_USER --password-stdin
                        docker push $DOCKERHUB_IMAGE:$TAG
                        docker push $DOCKERHUB_IMAGE:build-${BUILD_NUMBER}
                    '''
                }
            }
        }
        
        stage('Push to Azure Container Registry') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'acr',
                    usernameVariable: 'ACR_USER',
                    passwordVariable: 'ACR_PASS'
                )]) {
                    sh '''
                        echo $ACR_PASS | docker login $ACR_LOGIN_SERVER -u $ACR_USER --password-stdin
                        docker push $ACR_IMAGE:$TAG
                        docker push $ACR_IMAGE:build-${BUILD_NUMBER}
                        echo "✅ Pushed to ACR: $ACR_IMAGE:$TAG"
                        echo "✅ Pushed to ACR: $ACR_IMAGE:build-${BUILD_NUMBER}"
                    '''
                }
            }
        }
        
        stage('Update Azure Container App') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'acr',
                    usernameVariable: 'ACR_USER',
                    passwordVariable: 'ACR_PASS'
                )]) {
                    sh '''
                        # Update the container app to use the new image
                        # Requires azure-cli installed on Jenkins agent
                        if command -v az &> /dev/null; then
                            az containerapp update \
                              --name ccmp-apim \
                              --resource-group ${AZURE_RESOURCE_GROUP:-your-resource-group} \
                              --image $ACR_IMAGE:$TAG \
                              --output table || echo "⚠️  az cli update skipped — update manually in Azure Portal"
                        else
                            echo "⚠️  Azure CLI not installed on agent — image pushed to ACR, update container app manually"
                            echo "   New image: $ACR_IMAGE:$TAG"
                        fi
                    '''
                }
            }
        }
    }
    
    post {
        success {
            echo "✅ Build ${BUILD_NUMBER} pushed successfully!"
            echo "   Docker Hub: ${DOCKERHUB_IMAGE}:${TAG}"
            echo "   ACR:        ${ACR_IMAGE}:${TAG}"
        }
        failure {
            echo '❌ Pipeline failed!'
        }
        always {
            sh 'docker image prune -f || true'
        }
    }
}
