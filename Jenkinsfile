pipeline {
    agent any
    
    triggers {
        pollSCM('* * * * *')  // Poll every minute
    }
    
    environment {
        IMAGE_NAME = "reddy321678/apim"
        TAG = "latest"
        HTTP_PROXY  = "http://192.168.1.70:3128"
        HTTPS_PROXY = "http://192.168.1.70:3128"
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
                sh 'echo "Checking Dockerfile..."'
                sh 'ls -l Dockerfile.combined.ci'
            }
        }
        
        stage('Build Combined Docker Image') {
            steps {
                script {
                    sh '''
                        docker build \
                          -f Dockerfile.combined.ci \
                          --build-arg http_proxy=$HTTP_PROXY \
                          --build-arg https_proxy=$HTTPS_PROXY \
                          --build-arg HTTP_PROXY=$HTTP_PROXY \
                          --build-arg HTTPS_PROXY=$HTTPS_PROXY \
                          -t $IMAGE_NAME:$TAG .
                    '''
                }
            }
        }
        
        stage('Docker Login') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'docker',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    sh '''
                        echo $DOCKER_PASS | docker login -u $DOCKER_USER --password-stdin
                    '''
                }
            }
        }
        
        stage('Push Docker Image') {
            steps {
                sh '''
                    docker push $IMAGE_NAME:$TAG
                '''
            }
        }
        
        stage('Tag with Build Number') {
            steps {
                sh '''
                    docker tag $IMAGE_NAME:$TAG $IMAGE_NAME:build-${BUILD_NUMBER}
                    docker push $IMAGE_NAME:build-${BUILD_NUMBER}
                '''
            }
        }
    }
    
    post {
        success {
            echo '✅ APIM combined frontend + backend image pushed successfully!'
            echo "Image: ${IMAGE_NAME}:${TAG}"
            echo "Build: ${IMAGE_NAME}:build-${BUILD_NUMBER}"
        }
        failure {
            echo '❌ APIM pipeline failed!'
        }
        always {
            // Clean up dangling images
            sh 'docker image prune -f || true'
        }
    }
}
