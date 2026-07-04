# Asterisk — OFISDAGI mashinada ishlatish uchun (GSM gateway bilan bir tarmoqda).
# DIQQAT: bu konteyner DigitalOcean serverda EMAS, ofisdagi kompyuterda ishlaydi —
# SIP/RTP audio GSM gateway yonida bo'lishi kerak (aks holda ovoz sifati/NAT muammolari).
FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
    && apt-get install -y --no-install-recommends asterisk \
    && rm -rf /var/lib/apt/lists/*
# -f: foreground (konteyner uchun), -vvv: boshlang'ich diagnostika uchun o'rtacha loglar
CMD ["asterisk", "-f", "-vvv"]
