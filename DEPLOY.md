# Deploy

Single-container deploy: server + built client in one Docker image. ARM64
target (Oracle Cloud Ampere VM).

## Built artifact

`agentx-near-arm64.tar.gz` — load with `docker load` on the VM.

## On the VM (one-time setup)

```bash
# 1. Move Docker data dir to /var/oled (root partition is tight)
sudo systemctl stop docker
sudo mkdir -p /var/oled/docker
echo '{"data-root":"/var/oled/docker"}' | sudo tee /etc/docker/daemon.json
sudo systemctl start docker

# 2. Add yourself to the docker group
sudo usermod -aG docker $USER
# logout + login

# 3. Open the OS firewall (port 80 — nginx terminates here)
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --reload

# 4. Open port 80 in Oracle Cloud:
#    Networking → VCN → Security Lists → Default → Add Ingress Rule
#    Source 0.0.0.0/0, Protocol TCP, Destination Port 80
```

## NEAR — env vars

Run `npm run deploy:testnet` on your laptop first (see README). It writes `server/.env`
with the root account, game contract and voucher key. Copy that file to the VM as `.env`.

The root account (`AGENTX_ROOT_ACCOUNT_ID`) pays for:
- creating each agent's named account (0.005 NEAR each, `AGENT_ACCOUNT_DEPOSIT`)
- gas for every relayed meta transaction (≈0.0003–0.001 NEAR per swap)

Check its balance on https://testnet.nearblocks.io and top it up before demos.

## Each deploy

```bash
# On laptop — copy image + compose + nginx config + deploy helper
KEY=~/Downloads/ssh-key-2024-11-08.key   # adjust to your key
HOST=opc@<vm-ip>
scp -i $KEY agentx-near-arm64.tar.gz docker-compose.yml scripts/deploy-vm.sh $HOST:~/
scp -i $KEY -r nginx $HOST:~/

# On VM
ssh -i $KEY $HOST
gunzip -k agentx-near-arm64.tar.gz
docker load -i agentx-near-arm64.tar

# .env = server/.env from `npm run deploy:testnet` (only needed once)
scp -i $KEY server/.env $HOST:~/.env

docker compose up -d
docker compose logs -f
```

## Verify

```bash
curl http://<vm-ip>/api/prices
# → {"ready":true,"prices":{"plank":0.2,...},"contracts":{"chain":"near",...}}

# Browser:
http://<vm-ip>/world
```

## Update agents to point at the deployed server

```bash
node agent/cli/index.js init                  # asks for server URL during setup
# OR override existing config:
node agent/cli/index.js run agent_01 --server http://<vm-ip>
```

## Build the tarball locally

```bash
# One-time: register ARM64 emulator + create cross-platform builder
docker run --privileged --rm tonistiigi/binfmt --install arm64
docker buildx create --name arm-builder --driver docker-container --use
docker buildx inspect --bootstrap

# Build
docker buildx build \
  --platform linux/arm64 \
  --tag agentx-near:latest \
  --output type=docker,dest=agentx-near-arm64.tar \
  .
gzip -9 agentx-near-arm64.tar
```
