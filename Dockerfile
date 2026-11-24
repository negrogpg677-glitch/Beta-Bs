# Serveur multijoueur Brawl Rush (jeu servi aussi sur http://serveur/)
FROM node:22-alpine
WORKDIR /app
COPY server/package.json server/package-lock.json server/
RUN cd server && npm ci --omit=dev
COPY server server
COPY app/src/main/assets/www app/src/main/assets/www
ENV PORT=8080 DATA_DIR=/data FILL_WAIT=12
VOLUME /data
EXPOSE 8080
CMD ["node", "server/server.js"]
