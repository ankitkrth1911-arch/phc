import logging
import httpx
from typing import Dict, Any, Optional
from backend.config import GEMINI_API_KEY

logger = logging.getLogger(__name__)

class ExplanationService:
    def __init__(self, api_key: str = GEMINI_API_KEY):
        self.api_key = api_key.strip() if api_key else ""

    def generate_explanation(
        self,
        phc_id: str,
        phc_name: str,
        district_id: str,
        medicine_id: str,
        risk_score: float,
        risk_level: str,
        days_to_stockout: int,
        scenario_name: str,
        transfers_for_phc: list,
        safety_stock: int = 0
    ) -> Dict[str, str]:
        """Generates a plain-language explanation via LLM or grounded fallback template."""
        # Classify incoming vs outgoing transfers
        incoming = [t for t in transfers_for_phc if t.get("to_phc") == phc_id]
        outgoing = [t for t in transfers_for_phc if t.get("from_phc") == phc_id]

        incoming_total = sum(t.get("quantity", 0) for t in incoming)
        outgoing_total = sum(t.get("quantity", 0) for t in outgoing)

        # Build grounded fallback template
        template_text = self._build_grounded_template(
            phc_name=phc_name,
            district_id=district_id,
            medicine_id=medicine_id,
            risk_score=risk_score,
            risk_level=risk_level,
            days_to_stockout=days_to_stockout,
            scenario_name=scenario_name,
            incoming=incoming,
            outgoing=outgoing,
            incoming_total=incoming_total,
            outgoing_total=outgoing_total,
            safety_stock=safety_stock
        )

        if not self.api_key:
            return {
                "text": template_text,
                "source": "template"
            }

        # Attempt LLM call
        try:
            llm_text = self._call_gemini(
                phc_name=phc_name,
                district_id=district_id,
                medicine_id=medicine_id,
                risk_score=risk_score,
                risk_level=risk_level,
                days_to_stockout=days_to_stockout,
                scenario_name=scenario_name,
                incoming=incoming,
                outgoing=outgoing,
                incoming_total=incoming_total,
                outgoing_total=outgoing_total
            )
            if llm_text:
                return {
                    "text": llm_text,
                    "source": "llm"
                }
        except Exception as e:
            logger.warning(f"Gemini API explanation request failed: {e}. Falling back to template.")

        return {
            "text": template_text,
            "source": "template"
        }

    def _build_grounded_template(
        self,
        phc_name: str,
        district_id: str,
        medicine_id: str,
        risk_score: float,
        risk_level: str,
        days_to_stockout: int,
        scenario_name: str,
        incoming: list,
        outgoing: list,
        incoming_total: int,
        outgoing_total: int,
        safety_stock: int
    ) -> str:
        clean_dist = district_id.replace("DIST_", "").title()
        med_clean = medicine_id.replace("_", " ").title()

        if incoming:
            donor_details = ", ".join([f"{t['quantity']} units from {t['from_phc']} ({t['distance_km']} km)" for t in incoming[:2]])
            return (
                f"Under the {scenario_name} emergency, {phc_name} in {clean_dist} faces a {risk_level} "
                f"stockout risk of {risk_score}% with approximately {days_to_stockout} day(s) of {med_clean} runway remaining. "
                f"To resolve this acute shortage before depletion, the optimization engine scheduled an emergency transfer of "
                f"{incoming_total} units ({donor_details}). This dispatch restores local buffer coverage while strictly preserving donor safety stocks."
            )
        elif outgoing:
            rec_details = ", ".join([f"{t['quantity']} units to {t['to_phc']} ({t['distance_km']} km)" for t in outgoing[:2]])
            return (
                f"Under the {scenario_name} protocol, {phc_name} maintains healthy reserves of {med_clean} with "
                f"{days_to_stockout} days of operational coverage. Operating as a regional donor hub, it has been designated to transfer "
                f"{outgoing_total} units ({rec_details}), keeping its own mandatory reserve safely above {safety_stock} units."
            )
        elif risk_level == "Critical":
            return (
                f"Under the {scenario_name} protocol, {phc_name} in {clean_dist} has reached a Critical stockout risk of {risk_score}% "
                f"with {days_to_stockout} day(s) of {med_clean} inventory. Nearby donor corridors are currently at capacity limit; "
                f"immediate state-level central warehouse replenishment is recommended."
            )
        else:
            return (
                f"Under the {scenario_name} scenario, {phc_name} registers a {risk_level} risk score of {risk_score}% "
                f"for {med_clean} with an estimated {days_to_stockout} days of stock coverage. Regional inventories and transit corridors "
                f"remain stable with no emergency redistribution required at this moment."
            )

    def _call_gemini(
        self,
        phc_name: str,
        district_id: str,
        medicine_id: str,
        risk_score: float,
        risk_level: str,
        days_to_stockout: int,
        scenario_name: str,
        incoming: list,
        outgoing: list,
        incoming_total: int,
        outgoing_total: int
    ) -> Optional[str]:
        """Calls Google Gemini API with strict factual grounding."""
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={self.api_key}"

        prompt = (
            "You are a public health logistics commander in India. "
            "Write a concise, professional 2-3 sentence situational briefing for health administrators. "
            "Explain the risk status and redistribution decision. "
            "CRITICAL RULE: You MUST strictly use ONLY the verified facts and numbers provided below. "
            "Never invent or hallucinate unlisted statistics or numbers.\n\n"
            f"- Health Centre: {phc_name} ({district_id})\n"
            f"- Scenario: {scenario_name}\n"
            f"- Medicine: {medicine_id}\n"
            f"- Risk Assessment: {risk_level} ({risk_score}%)\n"
            f"- Days Until Stockout: {days_to_stockout} days\n"
            f"- Incoming Transfers: {incoming_total} units total. Details: {incoming}\n"
            f"- Outgoing Transfers: {outgoing_total} units total. Details: {outgoing}\n"
        )

        payload = {
            "contents": [
                {
                    "parts": [{"text": prompt}]
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 180
            }
        }

        with httpx.Client(timeout=5.0) as client:
            resp = client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        text = parts[0].get("text", "").strip()
                        if text:
                            return text
            else:
                logger.warning(f"Gemini API returned status {resp.status_code}: {resp.text}")
        return None
