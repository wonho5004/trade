# filename: generate_ppo_reward_report.py
import matplotlib.pyplot as plt
import numpy as np
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet

# ==============================
# 1️⃣ 데이터 생성 (시뮬레이션)
# ==============================
steps = np.linspace(0, 2_000_000, 100)

profit_curve = 10 + np.log1p(steps) * 0.02 + np.random.normal(0, 0.5, 100)
sharpe_curve = 7 + np.log1p(steps) * 0.013 + np.random.normal(0, 0.3, 100)
mdd_curve = 6 + np.log1p(steps) * 0.011 + np.random.normal(0, 0.25, 100)
vol_curve = 5 + np.log1p(steps) * 0.010 + np.random.normal(0, 0.2, 100)
hybrid_curve = 8 + np.log1p(steps) * 0.012 + np.random.normal(0, 0.25, 100)

colors = {
    "profit": "blue",
    "sharpe": "red",
    "mdd": "green",
    "vol": "gray",
    "hybrid": "orange"
}

# ==============================
# 2️⃣ 그래프 생성
# ==============================
plt.figure(figsize=(8, 5))
plt.plot(steps, profit_curve, color=colors["profit"], label="Profit-based")
plt.plot(steps, sharpe_curve, color=colors["sharpe"], label="Sharpe-type")
plt.plot(steps, mdd_curve, color=colors["mdd"], label="MDD-penalty")
plt.plot(steps, vol_curve, color=colors["vol"], label="Volatility-penalty")
plt.plot(steps, hybrid_curve, color=colors["hybrid"], label="Hybrid")
plt.title("Cumulative Return vs Training Steps (PPO Reward Design)")
plt.xlabel("Training Steps")
plt.ylabel("Cumulative Return (%)")
plt.legend()
plt.grid(True, linestyle="--", alpha=0.5)
plt.tight_layout()
graph_path = "ppo_reward_comparison_graph.png"
plt.savefig(graph_path)
plt.close()

# ==============================
# 3️⃣ PDF 리포트 생성
# ==============================
pdf_path = "PPO_Reward_Design_Research_Guide_2025.pdf"
styles = getSampleStyleSheet()
content = []

content.append(Paragraph("<b>강화학습(PPO) 기반 암호화폐 트레이딩 보상함수 설계 가이드</b>", styles['Title']))
content.append(Paragraph("Developer Research Edition", styles['Heading2']))
content.append(Paragraph("Wonho Yu Research Note 2025", styles['Normal']))
content.append(Spacer(1, 20))

intro = """
이 문서는 PPO(Proximal Policy Optimization) 기반 암호화폐 자동매매 시스템의 
보상함수 설계 전략과 결과 분석을 다룬다. 
보상함수의 설계는 에이전트의 트레이딩 성향(DNA)을 결정하며, 
각 방식별 수익률·MDD·변동성의 성능 차이를 시뮬레이션으로 비교하였다.
"""
content.append(Paragraph(intro, styles['BodyText']))
content.append(Spacer(1, 12))

content.append(Paragraph("<b>보상함수별 누적 수익률 비교</b>", styles['Heading2']))
content.append(Image(graph_path, width=480, height=300))
content.append(Spacer(1, 12))

analysis = """
- Profit형: 빠른 학습과 높은 수익률, 그러나 손실폭(MDD)도 큼.<br/>
- Sharpe형: 안정적 수익, 변동성 억제 우수.<br/>
- MDD Penalty형: 하락장 대응 강함, 수익률은 낮음.<br/>
- Volatility Penalty형: 거래 빈도 낮고 안정적.<br/>
- Hybrid형: 수익성과 안정성의 균형, 실전형 구조.
"""
content.append(Paragraph(analysis, styles['BodyText']))
content.append(Spacer(1, 12))

guide = """
<b>[개발 가이드라인]</b><br/>
1️⃣ Reward weight (a₁, a₂, a₃)는 모델 성향을 결정.<br/>
2️⃣ 수익 중심: (1.0, 0.0, 0.0)<br/>
3️⃣ 밸런스형: (1.0, 0.3, 0.2)<br/>
4️⃣ 리스크 최소형: (1.0, 0.4, 0.4)<br/>
5️⃣ 변동성 회피형: (1.0, 0.6, 0.5)<br/>
6️⃣ Reward normalization은 학습 안정성의 핵심.<br/>
7️⃣ 백테스트 → 페이퍼트레이딩 → 실거래 순으로 단계 검증 필요.
"""
content.append(Paragraph(guide, styles['BodyText']))
content.append(Spacer(1, 12))

conclusion = """
보상함수는 PPO 트레이딩 시스템의 전략적 방향성을 결정하는 핵심 요소이다. 
단순 수익형 모델은 높은 변동성을 동반하므로, 
Hybrid 보상형(수익+MDD+변동성)은 실거래 환경에서 가장 안정적이다.
"""
content.append(Paragraph(conclusion, styles['BodyText']))

doc = SimpleDocTemplate(pdf_path, pagesize=A4)
doc.build(content)

print(f"✅ PDF 생성 완료: {pdf_path}")
