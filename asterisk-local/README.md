# Asterisk (Docker) — ofis mashinasi uchun

CRM DigitalOcean'da, **Asterisk esa OFISDA** (GSM gateway yonida) turishi kerak —
SIP/RTP audio gateway bilan bir lokal tarmoqda bo'lmasa ovoz sifati va NAT muammolari chiqadi.
Bu papka ofisdagi kompyuterda (Ubuntu/Debian + Docker) Asterisk'ni konteynerda ko'tarish uchun.

## Arxitektura

```
[Operator softphone] --SIP--> [Asterisk (ofis, Docker)] --SIP--> [GSM gateway] --SIM--> mijoz
                                    ^ AMI 5038 (faqat VPN)
[CRM app (DigitalOcean)] <----- Tailscale/WireGuard VPN ----->
```

## O'rnatish (ofis mashinasida)

1. Docker + Tailscale o'rnating (`curl -fsSL https://tailscale.com/install.sh | sh; tailscale up`).
   DigitalOcean serverga ham Tailscale o'rnating — ikkalasi bitta tarmoqda bo'ladi.
2. Shu papkani ofis mashinasiga ko'chiring va `conf/` ichini tahrirlang:
   - `manager.conf` — `secret` (AMI parol) va `permit` (CRM'ning Tailscale IP'si);
   - `pjsip.conf` — `GATEWAY_IP` (GSM gateway IP'si) va operator parollari;
   - `extensions.conf` — odatda tegilmaydi (kiruvchida ring-guruh xohlasangiz).
3. `docker compose up -d --build`
4. Tekshirish: `docker exec -it asterisk asterisk -rx "pjsip show endpoints"`
   (operator softphone ro'yxatdan o'tsa `Avail` ko'rinadi).

## CRM (.env DigitalOcean'da)

```
ASTERISK_ENABLED=true
ASTERISK_HOST=<ofis-mashina-tailscale-IP>   # masalan 100.101.102.103
ASTERISK_USERNAME=crm
ASTERISK_PASSWORD=<manager.conf'dagi secret>
ASTERISK_OPERATOR_CHANNEL=PJSIP/{ext}
ASTERISK_OUTBOUND_CONTEXT=from-internal
ASTERISK_DEFAULT_OPERATOR_EXT=101
ASTERISK_RECORDINGS_PATH=/recordings/calls
```
va `docker-compose.yml`da (CRM tomonda) app'ga volume oching:
`- /srv/asterisk-recordings:/recordings/calls:ro`

## Yozuvlarni serverga yuborish (rsync, har 5 daqiqada)

Ofis mashinasida (`crontab -e`):
```
*/5 * * * * rsync -az --remove-source-files /path/to/asterisk-local/recordings/ root@<server-tailscale-ip>:/srv/asterisk-recordings/
```
(`--remove-source-files` — yuborilgach ofisda o'chiriladi; qoldirish uchun olib tashlang.
SSH kalit sozlangan bo'lishi kerak: `ssh-keygen` + `ssh-copy-id`.)

## Diqqat

- AMI (5038) va SIP (5060) portlarini internetga OCHMANG — faqat lokal tarmoq + VPN.
- Operator softphone'lari ofis Wi-Fi'sida ishlaydi; tashqaridan ishlash kerak bo'lsa,
  operator telefoniga ham Tailscale o'rnatiladi.
