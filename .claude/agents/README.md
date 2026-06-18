# Subagent Tizimi

8 ta mutaxassislaggan agent IntellectCRM loyihasi uchun. Har biri o'z vazifasiga tayyorlangan.

## Agentlar ro'yxati

| Agent | Model | Vazifa | Triggerlar |
|-------|-------|--------|-----------|
| **git-agent** | haiku | Commit, push, PR, branch | "commit qil", "push qil", "PR och" |
| **devops-agent** | haiku | Docker, deploy, paket, log | "deploy", "docker compose", "ilovani ishga tushir" |
| **status-agent** | haiku | Holat, loyiha progress | "holat", "qayerda qoldik", "keyingi qadam" |
| **docs-agent** | haiku | README, API, JSDoc, changelog | "hujjat yoz", "README", "changelog" |
| **debug-agent** | sonnet | Xato tuzatish, stack trace | "xato", "nega", "404", "crash" |
| **builder-agent** | sonnet | Yangi funksiya qo'shish (spec) | "implement", "qur", "feature" |
| **senior-dev-agent** | opus | Murakkab refactor, servislar orasidagi xatolar | "5+ fayl", "murakkab", "bug holda" |
| **architect-agent** | opus | Tizim dizayn, variantlar tahlili (KOD EMAS) | "architecture", "qaysi variant", "loyalty loyihala" |

## Ishlatish

Loyihada muammo/talab bo'lsa, o'zingiz delegatsiya qil:

```
Agent({
  description: "git commit va push",
  subagent_type: "git-agent",
  prompt: "Commit message: 'FIX: editStudentCharge groupId param'. Keyin push."
})
```

Yoki birdan tavsiya:
- **Xato**: debug-agent (stack trace paste)
- **Murakkab bug**: senior-dev-agent (5+ fayl likely)
- **Yangi feature**: builder-agent (aniq spec bilan)
- **Architecture qaror**: architect-agent (variant tahlili)
- **Deploy kerak**: devops-agent
- **Hujjat**: docs-agent

## TASDIQ Qoidasi

Har bir agent **QAYTARILMAYATGAN** amal'dan oldin tasdiq so'raydi:
- git force-push, branch o'chirish
- docker restart, paket o'rnatish
- fayl delete, code yazish (destructive)

Tasdiq = foydalanuvchi "Ha" deguncha QILMASLIK.
