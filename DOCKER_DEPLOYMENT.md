# Docker Desktop 배포 가이드

## 🐳 Docker로 실행하는 이유

**Vercel 서버리스 환경의 제약사항:**
- ❌ `setInterval`이 요청 종료 후 중지됨
- ❌ 여러 인스턴스가 동시에 실행되어 상태 충돌
- ❌ Singleton 패턴이 프로세스 간에 작동하지 않음

**Docker의 장점:**
- ✅ Stateful 환경 - 메모리 상태 유지
- ✅ ExecutionEngine 모니터링 모드 정상 작동
- ✅ WebSocket 연결 지속
- ✅ 단일 인스턴스 보장

---

## 📋 사전 준비

1. **Docker Desktop 설치**
   - Mac: https://www.docker.com/products/docker-desktop
   - Windows: https://www.docker.com/products/docker-desktop

2. **환경 변수 설정**
   - `.env.local` 파일이 프로젝트 루트에 있는지 확인
   - 필요한 환경 변수:
     ```
     NEXT_PUBLIC_SUPABASE_URL=...
     NEXT_PUBLIC_SUPABASE_ANON_KEY=...
     SUPABASE_SERVICE_ROLE_KEY=...
     BINANCE_API_KEY=...
     BINANCE_API_SECRET=...
     ENCRYPTION_KEY=...
     ```

---

## 🚀 배포 방법

### 1. Docker 이미지 빌드 및 실행

```bash
# 1. 프로젝트 디렉토리로 이동
cd /Users/wonho/dev/binance/trader

# 2. Docker Compose로 빌드 및 실행
docker-compose up -d --build

# 3. 로그 확인
docker-compose logs -f
```

### 2. 접속 확인

브라우저에서 http://localhost:3000 접속

---

## 🔧 관리 명령어

### 컨테이너 상태 확인
```bash
docker ps
```

### 로그 보기
```bash
# 실시간 로그
docker-compose logs -f

# 최근 100줄
docker-compose logs --tail 100
```

### 재시작
```bash
docker-compose restart
```

### 중지
```bash
docker-compose down
```

### 완전 삭제 (데이터 포함)
```bash
docker-compose down -v
docker system prune -a
```

### 컨테이너 내부 접속
```bash
docker exec -it binance-trader sh
```

---

## ⚙️ Docker Desktop 설정

### 1. 자동 시작 설정

**Mac:**
- Docker Desktop → Preferences → General
- ✅ Start Docker Desktop when you log in

**Windows:**
- Docker Desktop → Settings → General
- ✅ Start Docker Desktop when you log in

### 2. 리소스 할당

**Docker Desktop → Settings → Resources:**
- **CPUs:** 2-4 cores (권장: 2)
- **Memory:** 2-4 GB (권장: 3 GB)
- **Swap:** 1 GB

---

## 🔄 업데이트 및 재배포

코드 변경 후 재배포:

```bash
# 1. 코드 업데이트 (git pull 또는 수동 수정)
git pull

# 2. 컨테이너 재빌드 및 재시작
docker-compose down
docker-compose up -d --build

# 3. 로그 확인
docker-compose logs -f
```

---

## 🛡️ 보안 설정

### 1. 포트 노출 제한

`docker-compose.yml`에서 localhost만 접근 가능하도록 설정됨:
```yaml
ports:
  - "127.0.0.1:3000:3000"  # 외부에서 접근 불가
```

### 2. 환경 변수 보호

- `.env.local` 파일은 `.gitignore`에 포함됨
- Docker 이미지에 환경 변수가 포함되지 않음 (런타임에 주입)

---

## 📊 모니터링

### Health Check

컨테이너 상태 자동 확인:
```bash
docker inspect binance-trader | grep -A 10 Health
```

### 리소스 사용량

```bash
docker stats binance-trader
```

---

## ⚠️ 주의사항

### 1. 컴퓨터가 항상 켜져있어야 함
- 전력 절약 모드 해제
- 자동 절전 모드 비활성화

### 2. 네트워크 안정성
- 인터넷 연결이 안정적이어야 함
- Binance API 호출 실패시 자동 재시도 (Circuit Breaker 패턴)

### 3. 디스크 공간
- 로그 파일이 쌓일 수 있음
- 주기적으로 정리 필요:
  ```bash
  docker system prune -a
  ```

### 4. 백업
- `.env.local` 파일 백업 필수
- Supabase에 데이터가 저장되므로 별도 DB 백업 불필요

---

## 🐛 문제 해결

### 컨테이너가 계속 재시작됨
```bash
# 로그 확인
docker-compose logs

# 일반적인 원인:
# 1. .env.local 파일 누락
# 2. 환경 변수 오류
# 3. 포트 3000 이미 사용 중
```

### 포트 3000이 이미 사용 중
```bash
# Mac/Linux
lsof -i :3000
kill -9 <PID>

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### WebSocket 연결 실패
```bash
# Binance API 연결 확인
curl https://fapi.binance.com/fapi/v1/ping

# 방화벽 확인
# Docker Desktop → Settings → Resources → Network
```

---

## 🔄 운영 체크리스트

### 매일
- [ ] 컨테이너 상태 확인: `docker ps`
- [ ] 로그 확인: `docker-compose logs --tail 100`

### 매주
- [ ] 디스크 공간 확인: `df -h`
- [ ] Docker 캐시 정리: `docker system prune`

### 매월
- [ ] `.env.local` 백업
- [ ] Docker Desktop 업데이트

---

## 📞 지원

문제가 발생하면:
1. 로그 확인: `docker-compose logs -f`
2. 컨테이너 상태: `docker ps -a`
3. Health check: `curl http://localhost:3000/api/health`
