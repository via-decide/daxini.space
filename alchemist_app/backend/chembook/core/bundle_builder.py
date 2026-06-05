import json
import hashlib
import zipfile
from pathlib import Path
from datetime import datetime

def generate_viabundle(chapters: list, exercises: list, examples: list, output_dir: Path, bundle_id: str = "chem-os-v1"):
    """
    Takes the parsed chapters, exercises, and examples from the Alchemist pipeline
    and maps them into the strict Lore Labs Ecosystem Cartridge schema (.viabundle).
    """
    
    # 1. Structure the Payload
    payload = {
        "metadata": {
            "bundle_id": bundle_id,
            "version": "1.0.0",
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "domain": "Analytical Chemistry"
        },
        "StudyOS": {
            "nodes": []
        },
        "PrepOS": {
            "question_banks": []
        },
        "SkillHex": {
            "missions": []
        }
    }

    # Map Chapters to StudyOS Nodes
    for i, chapter in enumerate(chapters):
        payload["StudyOS"]["nodes"].append({
            "node_id": f"chem_node_{i+1}",
            "title": chapter.get("title", f"Chapter {i+1}"),
            "content": chapter.get("content", ""),
            "render_type": "markdown+mathjax"
        })

    # Map Exercises to PrepOS
    for i, exercise in enumerate(exercises):
        payload["PrepOS"]["question_banks"].append({
            "bank_id": f"chem_qbank_{i+1}",
            "topic": exercise.get("topic", f"Quiz {i+1}"),
            "questions": exercise.get("questions", [])
        })

    # Map Examples to SkillHex Missions
    for i, example in enumerate(examples):
        payload["SkillHex"]["missions"].append({
            "mission_id": f"chem_mission_{i+1}",
            "title": example.get("title", f"Lab Scenario {i+1}"),
            "objective": example.get("objective", ""),
            "constraints": example.get("constraints", [])
        })

    # 2. Serialize and Hash
    raw_json = json.dumps(payload, indent=2, sort_keys=True)
    sha256_hash = hashlib.sha256(raw_json.encode('utf-8')).hexdigest()
    payload["metadata"]["hmac_signature"] = sha256_hash

    # Save the manifest.json
    manifest_path = output_dir / "manifest.json"
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(payload, f, indent=2)

    # 3. Zip into .viabundle
    bundle_path = output_dir / f"{bundle_id}.viabundle"
    with zipfile.ZipFile(bundle_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.write(manifest_path, arcname="manifest.json")
        
        # Add diagrams if they exist
        diagrams_dir = output_dir / "diagrams"
        if diagrams_dir.exists():
            for img in diagrams_dir.glob("*.png"):
                zf.write(img, arcname=f"assets/{img.name}")

    print(f"📦 Successfully built Lore Ecosystem Cartridge: {bundle_path}")
    print(f"   Signature (SHA-256): {sha256_hash}")
    
    return bundle_path, sha256_hash
