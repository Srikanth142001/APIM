#!/bin/bash

# App Insights Dashboard - Docker Commands Helper Script
# This script provides easy commands to manage the Docker container with dynamic ports

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
DEFAULT_PORT=80
DEFAULT_HOST_PORT=3000
IMAGE_NAME="app-insights-dashboard"
CONTAINER_NAME="app-insights-dashboard"

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to build the Docker image
build() {
    print_info "Building Docker image: $IMAGE_NAME"
    docker build -t $IMAGE_NAME .
    print_info "Build completed successfully!"
}

# Function to run container with custom port
run() {
    local PORT=${1:-$DEFAULT_PORT}
    local HOST_PORT=${2:-$DEFAULT_HOST_PORT}
    
    print_info "Starting container on port $HOST_PORT (container port: $PORT)"
    
    # Check if container already exists
    if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        print_warning "Container $CONTAINER_NAME already exists. Removing it..."
        docker rm -f $CONTAINER_NAME
    fi
    
    docker run -d \
        -p $HOST_PORT:$PORT \
        -e PORT=$PORT \
        --name $CONTAINER_NAME \
        $IMAGE_NAME
    
    print_info "Container started successfully!"
    print_info "Access the application at: http://localhost:$HOST_PORT"
}

# Function to stop container
stop() {
    print_info "Stopping container: $CONTAINER_NAME"
    docker stop $CONTAINER_NAME
    print_info "Container stopped successfully!"
}

# Function to start container
start() {
    print_info "Starting container: $CONTAINER_NAME"
    docker start $CONTAINER_NAME
    print_info "Container started successfully!"
}

# Function to restart container
restart() {
    print_info "Restarting container: $CONTAINER_NAME"
    docker restart $CONTAINER_NAME
    print_info "Container restarted successfully!"
}

# Function to view logs
logs() {
    print_info "Showing logs for container: $CONTAINER_NAME"
    docker logs -f $CONTAINER_NAME
}

# Function to remove container
remove() {
    print_info "Removing container: $CONTAINER_NAME"
    docker rm -f $CONTAINER_NAME
    print_info "Container removed successfully!"
}

# Function to clean up (remove container and image)
clean() {
    print_warning "This will remove the container and image. Continue? (y/n)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        print_info "Cleaning up..."
        docker rm -f $CONTAINER_NAME 2>/dev/null || true
        docker rmi $IMAGE_NAME 2>/dev/null || true
        print_info "Cleanup completed!"
    else
        print_info "Cleanup cancelled."
    fi
}

# Function to show status
status() {
    print_info "Container status:"
    docker ps -a --filter "name=$CONTAINER_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
}

# Function to execute shell in container
shell() {
    print_info "Opening shell in container: $CONTAINER_NAME"
    docker exec -it $CONTAINER_NAME sh
}

# Function to show help
show_help() {
    cat << EOF
App Insights Dashboard - Docker Management Script

Usage: ./docker-commands.sh [COMMAND] [OPTIONS]

Commands:
    build                   Build the Docker image
    run [PORT] [HOST_PORT]  Run container (default: container=80, host=3000)
    stop                    Stop the container
    start                   Start the container
    restart                 Restart the container
    logs                    View container logs (follow mode)
    remove                  Remove the container
    clean                   Remove container and image
    status                  Show container status
    shell                   Open shell in container
    help                    Show this help message

Examples:
    # Build image
    ./docker-commands.sh build

    # Run on default ports (container: 80, host: 3000)
    ./docker-commands.sh run

    # Run on custom ports (container: 8080, host: 8080)
    ./docker-commands.sh run 8080 8080

    # Run on port 5000 inside container, 9000 on host
    ./docker-commands.sh run 5000 9000

    # View logs
    ./docker-commands.sh logs

    # Stop container
    ./docker-commands.sh stop

    # Clean up everything
    ./docker-commands.sh clean

EOF
}

# Main script logic
case "${1:-help}" in
    build)
        build
        ;;
    run)
        run "$2" "$3"
        ;;
    stop)
        stop
        ;;
    start)
        start
        ;;
    restart)
        restart
        ;;
    logs)
        logs
        ;;
    remove)
        remove
        ;;
    clean)
        clean
        ;;
    status)
        status
        ;;
    shell)
        shell
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
