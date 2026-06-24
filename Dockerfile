# ============================================================================
#  IntellectCRM — bitta o'quv markazi uchun yagona obraz (API + SPA)
#  3 bosqich: (1) SPA build (node) -> (2) API publish (.NET 8) -> (3) runtime
# ============================================================================

# ---------- 1) Frontend (Vite) build ----------
FROM node:20-alpine AS client
WORKDIR /client
COPY IntellectCRM.Client/package*.json ./
RUN npm ci
COPY IntellectCRM.Client/ ./
# Build-time env: frontend real domenni tanishi va REAL API'ga (mock emas) ulanishi uchun.
ARG VITE_ROOT_DOMAIN=intellectcrm.uz
ARG VITE_USE_MOCK=false
ENV VITE_ROOT_DOMAIN=$VITE_ROOT_DOMAIN VITE_USE_MOCK=$VITE_USE_MOCK
RUN npm run build        # natija: /client/dist

# ---------- 2) Backend (.NET) publish ----------
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
# Avval faqat csproj'lar — qatlam keshini saqlash uchun. Klient (esproj) Docker'da qurilmaydi.
COPY IntellectCRM.Domain/IntellectCRM.Domain.csproj IntellectCRM.Domain/
COPY IntellectCRM.Application/IntellectCRM.Application.csproj IntellectCRM.Application/
COPY IntellectCRM.Infrastructure/IntellectCRM.Infrastructure.csproj IntellectCRM.Infrastructure/
COPY IntellectCRM.Server/IntellectCRM.Server.csproj IntellectCRM.Server/
RUN dotnet restore IntellectCRM.Server/IntellectCRM.Server.csproj -p:BuildSpa=false
COPY IntellectCRM.Domain/ IntellectCRM.Domain/
COPY IntellectCRM.Application/ IntellectCRM.Application/
COPY IntellectCRM.Infrastructure/ IntellectCRM.Infrastructure/
COPY IntellectCRM.Server/ IntellectCRM.Server/
RUN dotnet publish IntellectCRM.Server/IntellectCRM.Server.csproj -c Release -o /app/publish \
    -p:BuildSpa=false --no-restore

# ---------- 3) Runtime ----------
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
# Markaz mintaqasi (UTC+5). tzdata — TimeZoneInfo "Asia/Tashkent"ni topishi uchun;
# TZ — log/uchinchi-tomon kutubxonalar ham mahalliy vaqtda bo'lishi uchun.
ENV TZ=Asia/Tashkent
RUN apt-get update && apt-get install -y --no-install-recommends tzdata \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/publish ./
# Qurilgan SPA'ni server statik papkasiga qo'yamiz (API ham, SPA ham bitta originda).
COPY --from=client /client/dist ./wwwroot
# Apex domen (intellectschool.uz) marketing sayti — page/ statik fayllari (host-based serving).
COPY page/ ./page/
ENV ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "IntellectCRM.Server.dll"]
