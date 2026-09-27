from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import (
    BenchmarkSource,
    ComponentAlias,
    ComponentSpecification,
    HardwareComponent,
)

CURATED_HARDWARE_CATALOG: list[dict[str, object]] = [
    {
        "component_type": "CPU",
        "brand": "AMD",
        "model_name": "Ryzen 7 7800X3D",
        "generation": "Zen 4",
        "release_date": date(2023, 4, 6),
        "specs": {"core_count": 8, "thread_count": 16, "tdp_watts": 120, "socket": "AM5"},
        "aliases": ["AMD Ryzen 7 7800X3D", "AMD Ryzen 7 7800X3D 8-Core Processor"],
    },
    {
        "component_type": "CPU",
        "brand": "AMD",
        "model_name": "Ryzen 9 7950X",
        "generation": "Zen 4",
        "release_date": date(2022, 9, 27),
        "specs": {"core_count": 16, "thread_count": 32, "tdp_watts": 170, "socket": "AM5"},
        "aliases": ["AMD Ryzen 9 7950X", "AMD Ryzen 9 7950X 16-Core Processor"],
    },
    {
        "component_type": "CPU",
        "brand": "Intel",
        "model_name": "Core i5-13600K",
        "generation": "Raptor Lake",
        "release_date": date(2022, 10, 20),
        "specs": {"core_count": 14, "thread_count": 20, "tdp_watts": 125, "socket": "LGA1700"},
        "aliases": ["Intel Core i5-13600K", "13th Gen Intel(R) Core(TM) i5-13600K"],
    },
    {
        "component_type": "CPU",
        "brand": "AMD",
        "model_name": "Ryzen 5 5600X",
        "generation": "Zen 3",
        "release_date": date(2020, 11, 5),
        "specs": {"core_count": 6, "thread_count": 12, "tdp_watts": 65, "socket": "AM4"},
        "aliases": ["AMD Ryzen 5 5600X", "AMD Ryzen 5 5600X 6-Core Processor"],
    },
    {
        "component_type": "GPU",
        "brand": "NVIDIA",
        "model_name": "GeForce RTX 4090",
        "generation": "Ada Lovelace",
        "release_date": date(2022, 10, 12),
        "specs": {"vram_gb": 24, "tdp_watts": 450, "bus_width_bit": 384},
        "aliases": ["NVIDIA GeForce RTX 4090", "GeForce RTX 4090"],
    },
    {
        "component_type": "GPU",
        "brand": "NVIDIA",
        "model_name": "GeForce RTX 4070 SUPER",
        "generation": "Ada Lovelace",
        "release_date": date(2024, 1, 17),
        "specs": {"vram_gb": 12, "tdp_watts": 220, "bus_width_bit": 192},
        "aliases": ["NVIDIA GeForce RTX 4070 SUPER", "GeForce RTX 4070 SUPER"],
    },
    {
        "component_type": "GPU",
        "brand": "AMD",
        "model_name": "Radeon RX 7800 XT",
        "generation": "RDNA 3",
        "release_date": date(2023, 9, 6),
        "specs": {"vram_gb": 16, "tdp_watts": 263, "bus_width_bit": 256},
        "aliases": ["AMD Radeon RX 7800 XT", "Radeon RX 7800 XT"],
    },
    {
        "component_type": "GPU",
        "brand": "NVIDIA",
        "model_name": "GeForce RTX 3060",
        "generation": "Ampere",
        "release_date": date(2021, 2, 25),
        "specs": {"vram_gb": 12, "tdp_watts": 170, "bus_width_bit": 192},
        "aliases": ["NVIDIA GeForce RTX 3060", "GeForce RTX 3060"],
    },
    {
        "component_type": "RAM",
        "brand": "G.Skill",
        "model_name": "Trident Z5 Neo 32GB DDR5-6000 CL30",
        "generation": "DDR5",
        "release_date": date(2022, 9, 1),
        "specs": {"ram_capacity_gb": 32, "memory_speed": "DDR5-6000", "cas_latency": 30},
        "aliases": ["G.Skill Trident Z5 Neo 32GB DDR5-6000", "32GB DDR5-6000 CL30"],
    },
    {
        "component_type": "RAM",
        "brand": "Corsair",
        "model_name": "Vengeance LPX 16GB DDR4-3200 CL16",
        "generation": "DDR4",
        "release_date": date(2019, 5, 1),
        "specs": {"ram_capacity_gb": 16, "memory_speed": "DDR4-3200", "cas_latency": 16},
        "aliases": ["Corsair Vengeance LPX 16GB DDR4-3200", "16GB DDR4-3200 CL16"],
    },
    {
        "component_type": "STORAGE",
        "brand": "Samsung",
        "model_name": "990 PRO 2TB NVMe PCIe 4.0",
        "generation": "PCIe 4.0 NVMe",
        "release_date": date(2022, 10, 1),
        "specs": {"storage_type": "NVMe PCIe 4.0", "capacity_gb": 2000},
        "aliases": ["Samsung SSD 990 PRO 2TB", "Samsung 990 PRO 2TB NVMe"],
    },
    {
        "component_type": "STORAGE",
        "brand": "Crucial",
        "model_name": "MX500 1TB SATA SSD",
        "generation": "SATA III",
        "release_date": date(2018, 1, 1),
        "specs": {"storage_type": "SATA SSD", "capacity_gb": 1000},
        "aliases": ["Crucial MX500 1TB SATA", "CT1000MX500SSD1"],
    },
]


def seed_curated_hardware_catalog(db: Session) -> None:
    blender_src = db.scalar(
        select(BenchmarkSource).where(BenchmarkSource.code == "blender_opendata")
    )
    if blender_src is None:
        db.add(
            BenchmarkSource(
                code="blender_opendata",
                source_name="Blender Open Data",
                benchmark_version="4.2",
                source_url="https://opendata.blender.org/",
                license_spdx="CC0-1.0",
                license_notes="CC0 public domain benchmark dataset from Blender Institute.",
                is_approved=True,
            )
        )

    pts_src = db.scalar(select(BenchmarkSource).where(BenchmarkSource.code == "phoronix_pts_local"))
    if pts_src is None:
        db.add(
            BenchmarkSource(
                code="phoronix_pts_local",
                source_name="SiliconSense Reproducible PTS Lab",
                benchmark_version="10.8.4",
                source_url="https://github.com/phoronix-test-suite/phoronix-test-suite",
                license_spdx="GPL-3.0-or-later",
                license_notes="Reproducible local benchmark suite executions.",
                is_approved=True,
            )
        )

    for entry in CURATED_HARDWARE_CATALOG:
        c_type = str(entry["component_type"])
        brand = str(entry["brand"])
        model_name = str(entry["model_name"])

        comp = db.scalar(
            select(HardwareComponent).where(
                HardwareComponent.component_type == c_type,
                HardwareComponent.brand == brand,
                HardwareComponent.model_name == model_name,
            )
        )
        if comp is None:
            r_date = entry["release_date"]
            comp = HardwareComponent(
                component_type=c_type,
                brand=brand,
                model_name=model_name,
                generation=str(entry["generation"]),
                release_date=r_date if isinstance(r_date, date) else None,
                is_verified=True,
            )
            db.add(comp)
            db.flush()

            specs: dict[str, object] = entry["specs"]  # type: ignore[assignment]
            db.add(
                ComponentSpecification(
                    component_id=comp.id,
                    core_count=int(str(specs["core_count"])) if "core_count" in specs else None,
                    thread_count=(
                        int(str(specs["thread_count"])) if "thread_count" in specs else None
                    ),
                    vram_gb=int(str(specs["vram_gb"])) if "vram_gb" in specs else None,
                    ram_capacity_gb=(
                        int(str(specs["ram_capacity_gb"])) if "ram_capacity_gb" in specs else None
                    ),
                    memory_speed=str(specs["memory_speed"]) if "memory_speed" in specs else None,
                    storage_type=str(specs["storage_type"]) if "storage_type" in specs else None,
                    specs_json=specs,
                    source_url="https://siliconsense.spideytech.dev/catalog/curated-v1",
                    last_verified_at=datetime.now(timezone.utc),
                )
            )

        aliases: list[str] = entry["aliases"]  # type: ignore[assignment]
        for alias_str in aliases:
            existing_alias = db.scalar(
                select(ComponentAlias).where(
                    ComponentAlias.component_type == c_type,
                    ComponentAlias.alias_name == alias_str,
                )
            )
            if existing_alias is None:
                db.add(
                    ComponentAlias(
                        component_id=comp.id,
                        component_type=c_type,
                        alias_name=alias_str,
                        source_name="curated_seed_v1",
                    )
                )

    db.commit()
