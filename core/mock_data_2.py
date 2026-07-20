# Звіти: метадані місяців і рядки won/confirmed

REPORT_TYPE_LABELS = {
    "won": "Виграні",
    "confirmed": "Підтверджені",
}

MONTHLY_REPORTS = {
    "2026-07": {
        "month": "Липень 2026",
        "month_key": "2026-07",
        "deal_count": 8,
    },
    "2026-06": {
        "month": "Червень 2026",
        "month_key": "2026-06",
        "deal_count": 10,
    },
    "2026-05": {
        "month": "Травень 2026",
        "month_key": "2026-05",
        "deal_count": 7,
    },
    "2026-04": {
        "month": "Квітень 2026",
        "month_key": "2026-04",
        "deal_count": 6,
    },
}

MONTHLY_REPORT = MONTHLY_REPORTS["2026-07"]

_CHF = {
    "currency": "CHF",
    "won_currency": "CHF",
    "bid_currency": "CHF",
    "cost_currency": "CHF",
    "price_currency": "CHF",
    "delivery_currency": "CHF",
}

REPORTS_BY_MONTH = {
    "2026-07": {
        "won": [
            {**_CHF, "car": "SEAT Ibiza 1.2 TSI", "client": "Сергій Шевчук", "stage": "Виграно", "won_price": 14800, "bid": 14600, "cost": 16980, "price": 20700, "delivery_cost": 950, "profit": 3720, "delivery_type": "ours"},
            {**_CHF, "car": "VW Golf 7 GTI 2.0 TSI", "client": "Ігор Мельник", "stage": "Виграно", "won_price": 10900, "bid": 10800, "cost": 12200, "price": 14900, "delivery_cost": 750, "profit": 2700, "delivery_type": "ours"},
            {**_CHF, "car": "Hyundai Tucson 1.6 T-GDI", "client": "Роман Гнатюк", "stage": "Виграно", "won_price": 8700, "bid": 8600, "cost": 9800, "price": 11900, "delivery_cost": 800, "profit": 2100, "delivery_type": "ours"},
            {**_CHF, "car": "Ford Kuga 2.0 EcoBoost", "client": "Юрій Савченко", "stage": "Виграно", "won_price": 9800, "bid": 9700, "cost": 11200, "price": 13600, "delivery_cost": 900, "profit": 2400, "delivery_type": "ours"},
        ],
        "confirmed": [
            {**_CHF, "car": "BMW X5 xDrive30d", "client": "Микита Горишній", "stage": "Підтверджено", "won_price": 30200, "bid": 30000, "cost": 33590, "price": 39291, "delivery_cost": 1800, "profit": 5700, "delivery_type": "ours", "deal_id": "AL-2026-047"},
            {**_CHF, "car": "Porsche Macan S", "client": "Артем Бойко", "stage": "Підтверджено", "won_price": 33200, "bid": 33000, "cost": 36800, "price": 44200, "delivery_cost": 1900, "profit": 7400, "delivery_type": "ours"},
            {**_CHF, "car": "Audi A6 3.0 TDI quattro", "client": "Денис Запорожець", "stage": "Підтверджено", "won_price": 25900, "bid": 25700, "cost": 28700, "price": 35000, "delivery_cost": 0, "profit": 6300, "delivery_type": "theirs"},
            {**_CHF, "car": "Volvo XC60 D5 AWD", "client": "Максим Ткаченко", "stage": "Підтверджено", "won_price": 19800, "bid": 19600, "cost": 22100, "price": 26800, "delivery_cost": 0, "profit": 4700, "delivery_type": "theirs"},
        ],
    },
    "2026-06": {
        "won": [
            {**_CHF, "car": "Tesla Model S 85 Performance D", "client": "Влад Олексюк", "stage": "Виграно", "won_price": 25800, "bid": 25600, "cost": 28354, "price": 34540, "delivery_cost": 1400, "profit": 6186, "delivery_type": "ours"},
            {**_CHF, "car": "Skoda Octavia RS 2.0 TSI", "client": "Павло Руденко", "stage": "Виграно", "won_price": 13800, "bid": 13600, "cost": 15400, "price": 18800, "delivery_cost": 0, "profit": 3400, "delivery_type": "theirs"},
            {**_CHF, "car": "Mazda CX-5 2.5 AWD", "client": "Степан Литвин", "stage": "Виграно", "won_price": 12800, "bid": 12600, "cost": 14300, "price": 17400, "delivery_cost": 0, "profit": 3100, "delivery_type": "theirs"},
            {**_CHF, "car": "BMW 320d xDrive Touring", "client": "Оксана М.", "stage": "Виграно", "won_price": 11500, "bid": 11400, "cost": 13100, "price": 16200, "delivery_cost": 950, "profit": 3100, "delivery_type": "ours"},
            {**_CHF, "car": "Peugeot 3008 GT Line", "client": "Лілія К.", "stage": "Виграно", "won_price": 13900, "bid": 13700, "cost": 15600, "price": 19100, "delivery_cost": 0, "profit": 3500, "delivery_type": "theirs"},
        ],
        "confirmed": [
            {**_CHF, "car": "Volkswagen Tiguan R-Line", "client": "Ірина С.", "stage": "Підтверджено", "won_price": 21800, "bid": 21600, "cost": 24436, "price": 29800, "delivery_cost": 0, "profit": 5364, "delivery_type": "pickup", "deal_id": "AL-2026-044"},
            {**_CHF, "car": "Mercedes-Benz GLC 300", "client": "Марина В.", "stage": "Підтверджено", "won_price": 29600, "bid": 29400, "cost": 31898, "price": 38900, "delivery_cost": 0, "profit": 7002, "delivery_type": "theirs", "deal_id": "AL-2026-046"},
            {**_CHF, "car": "Toyota RAV4 Hybrid", "client": "Віктор Л.", "stage": "Підтверджено", "won_price": 24800, "bid": 24600, "cost": 27388, "price": 33400, "delivery_cost": 0, "profit": 6012, "delivery_type": "theirs"},
            {**_CHF, "car": "Audi Q3 35 TFSI", "client": "Тарас Ж.", "stage": "Підтверджено", "won_price": 16900, "bid": 16700, "cost": 18900, "price": 23100, "delivery_cost": 1100, "profit": 4200, "delivery_type": "ours"},
            {**_CHF, "car": "Mercedes-AMG GLC 63 4MATIC", "client": "Олег Кравчук", "stage": "Підтверджено", "won_price": 41500, "bid": 41200, "cost": 45820, "price": 54800, "delivery_cost": 2100, "profit": 8980, "delivery_type": "ours"},
        ],
    },
    "2026-05": {
        "won": [
            {**_CHF, "car": "Opel Astra 1.4 Turbo", "client": "Богдан Ч.", "stage": "Виграно", "won_price": 7200, "bid": 7100, "cost": 8100, "price": 9900, "delivery_cost": 600, "profit": 1800, "delivery_type": "ours"},
            {**_CHF, "car": "Renault Megane GT", "client": "Костянтин Я.", "stage": "Виграно", "won_price": 9100, "bid": 9000, "cost": 10200, "price": 12500, "delivery_cost": 700, "profit": 2300, "delivery_type": "ours"},
            {**_CHF, "car": "Kia Sportage 1.6 T-GDI", "client": "Назар П.", "stage": "Виграно", "won_price": 15200, "bid": 15000, "cost": 16900, "price": 20600, "delivery_cost": 900, "profit": 3700, "delivery_type": "ours"},
        ],
        "confirmed": [
            {**_CHF, "car": "Nissan Qashqai 1.3 DIG-T", "client": "Олена Р.", "stage": "Підтверджено", "won_price": 14100, "bid": 13900, "cost": 15800, "price": 19200, "delivery_cost": 0, "profit": 3400, "delivery_type": "theirs"},
            {**_CHF, "car": "Honda CR-V Hybrid", "client": "Василь Д.", "stage": "Підтверджено", "won_price": 22100, "bid": 21900, "cost": 24500, "price": 29800, "delivery_cost": 1200, "profit": 5300, "delivery_type": "ours"},
            {**_CHF, "car": "Lexus NX 300h", "client": "Галина С.", "stage": "Підтверджено", "won_price": 27800, "bid": 27600, "cost": 30700, "price": 37400, "delivery_cost": 0, "profit": 6700, "delivery_type": "theirs"},
            {**_CHF, "car": "Subaru Forester 2.0", "client": "Тарас К.", "stage": "Підтверджено", "won_price": 16700, "bid": 16500, "cost": 18600, "price": 22700, "delivery_cost": 850, "profit": 4100, "delivery_type": "ours"},
        ],
    },
    "2026-04": {
        "won": [
            {**_CHF, "car": "Fiat 500X", "client": "Ірина Б.", "stage": "Виграно", "won_price": 8900, "bid": 8800, "cost": 9900, "price": 12100, "delivery_cost": 650, "profit": 2200, "delivery_type": "ours"},
            {**_CHF, "car": "Citroen C5 Aircross", "client": "Петро М.", "stage": "Виграно", "won_price": 13400, "bid": 13200, "cost": 14900, "price": 18200, "delivery_cost": 0, "profit": 3300, "delivery_type": "theirs"},
            {**_CHF, "car": "Jeep Compass 1.3", "client": "Андрій В.", "stage": "Виграно", "won_price": 15600, "bid": 15400, "cost": 17300, "price": 21100, "delivery_cost": 950, "profit": 3800, "delivery_type": "ours"},
        ],
        "confirmed": [
            {**_CHF, "car": "Land Rover Discovery Sport", "client": "Юлія Н.", "stage": "Підтверджено", "won_price": 31200, "bid": 31000, "cost": 34600, "price": 42100, "delivery_cost": 1800, "profit": 7500, "delivery_type": "ours"},
            {**_CHF, "car": "Alfa Romeo Stelvio", "client": "Дмитро Г.", "stage": "Підтверджено", "won_price": 24500, "bid": 24300, "cost": 27200, "price": 33100, "delivery_cost": 0, "profit": 5900, "delivery_type": "theirs"},
            {**_CHF, "car": "Mini Cooper Countryman", "client": "Софія Л.", "stage": "Підтверджено", "won_price": 17800, "bid": 17600, "cost": 19800, "price": 24100, "delivery_cost": 900, "profit": 4300, "delivery_type": "ours"},
        ],
    },
}

# Сумісність зі старим кодом
REPORT_SECTIONS = [
    {"name": "Виграні", "rows": REPORTS_BY_MONTH["2026-07"]["won"]},
    {"name": "Підтверджені", "rows": REPORTS_BY_MONTH["2026-07"]["confirmed"]},
]

