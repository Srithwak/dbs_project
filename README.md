# CarbonCoffee

A supply-chain procurement and order management system built with **FastAPI**, **Supabase (PostgreSQL)**, and a **vanilla HTML/CSS/JS** frontend. The centrepiece feature is a **transport optimization engine** that ranks shipping routes by cost, delivery time, and carbon footprint according to user preferences.

---

## Features

- **Buyer Dashboard** — browse products from multiple suppliers, place orders, view order history
- **Seller Dashboard** — manage products, update stock, monitor incoming orders
- **Transport Optimization Engine** — reconstructs multi-leg shipping routes, scores them on cost/speed/CO₂, and displays the top results on an interactive map
- **Carbon Goal Tracker** — set CO₂ reduction targets and compare against actual emissions
- **Data Seeding** — one-command script to populate the database with realistic synthetic data

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python · FastAPI · Uvicorn |
| Database | PostgreSQL on Supabase |
| Frontend | Vanilla HTML · CSS · JavaScript |
| ORM/Client | `supabase-py` |
| Config | `python-dotenv` |

---

## Project Structure

```
dbs_project/
├── app/
│   ├── main.py                  # FastAPI app factory & routes
│   └── services/
│       └── transport_engine.py  # Route optimization logic
├── initialize/
│   ├── relational_db.sql        # Full PostgreSQL schema
│   ├── initial_plan.md          # Original design document
│   └── .env.example             # Environment variable template
├── scripts/
│   └── generate_data.py         # Synthetic data seeder
├── static/
│   ├── index.html               # Single-page frontend
│   ├── script.js                # Frontend logic
│   └── style.css                # Styles
├── main.py                      # Application entry point
├── requirements.txt             # Python dependencies
├── .env.example                 # Root env template
├── start.bat                    # Windows quick-start
├── start.ps1                    # PowerShell quick-start
├── start.sh                     # Unix quick-start
└── SUPABASE_SETUP.md            # Supabase configuration guide
```

---

## Quick Start

### Prerequisites

- Python 3.10+
- A Supabase project (see [SUPABASE_SETUP.md](./SUPABASE_SETUP.md))

### 1. Clone the repo

```bash
git clone https://github.com/Srithwak/dbs_project.git
cd dbs_project
```

### 2. Create a virtual environment

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment variables

```bash
# Windows
Copy-Item .env.example .env

# macOS / Linux
cp .env.example .env
```

Open `.env` and fill in your Supabase credentials. See **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)** for a step-by-step guide.

### 5. Seed the database *(optional)*

```bash
python scripts/generate_data.py
```

### 6. Run the app

```bash
# Cross-platform
python main.py

# Or use the platform script
start.bat        # Windows CMD
.\start.ps1      # PowerShell
./start.sh       # macOS / Linux
```

The app will open at **http://localhost:8000**.

---

## Environment Variables

Copy `.env.example` → `.env` and fill in the values below.

| Variable | Description |
|---|---|
| `API_URL` | Your Supabase project URL |
| `ANON_API_KEY` | Public anon key (safe to use in backend) |
| `SERVICE_ROLE_KEY` | Service-role key (bypasses RLS — keep secret) |

> [!WARNING]
> Never commit your `.env` file. It is listed in `.gitignore`.

---

## Database Setup

Full schema and setup instructions are in **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)**.

The schema (`initialize/relational_db.sql`) creates the following tables:

- `product` · `supplier` · `users` · `transport_method` · `carbon_goal`
- `supplier_product` · `orders` · `order_item`

---

## Authors

- **Praneeth Rangarajan**
- **Rithwak Somepalli**

---

## License

This project was created for a university database systems course and is not intended for production use.
