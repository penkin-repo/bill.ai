# АЛГОРИТМ ПАРСИНГА CSV ТОВАРОВ ТРОТУАРНОЙ ПЛИТКИ

INPUT: csv_text (строка с CSV данными)
OUTPUT: список товаров [{name, code, collection, color, price, unit}]

1. ПАРСИНГ CSV
   rows = csv_parse(csv_text, delimiter=";", header=true)

2. РАЗДЕЛЕНИЕ НА РОДИТЕЛЕЙ И ДЕТЕЙ
   parents = {}  # словарь: Tilda UID → row
   children = []
   
   FOR row IN rows:
     uid = row["Tilda UID"]
     parent_uid = row["Parent UID"]
     has_price = float(row["Price"]) > 0
     has_category = row["Category"] не пусто
     
     IF parent_uid пусто AND (has_category OR NOT has_price):
       parents[uid] = row  # Это родитель
     ELSE:
       children.append(row)  # Это ребёнок

3. ОБРАБОТКА ДЕТЕЙ
   products = []
   parent_uids = set(parents.keys())
   
   FOR child IN children:
     price = float(child["Price"])
     IF price == 0: CONTINUE
     
     # 3.1 Найти родителя
     parent_uid = find_parent_uid(child, parent_uids)
     parent = parents.get(parent_uid)
     
     # 3.2 Извлечь коллекцию и цвет
     mods = extract_modifications(child)
     # Источники по приоритету:
     # - child["Modifications"]
     # - child["Editions"]  
     # - Все поля child (поиск "Коллекция:", "Цвет:")
     # - child["Title"] паттерн " - X - Y"
     
     # 3.3 Извлечь название и артикул
     title = parent["Title"] OR child["Title"]
     match = regex(title, /^(.+?)\s*\(([^)]+)\)/)
     name = match[1]  # "Классико"
     code = match[2]  # "Б.1.КО.6"
     
     # 3.4 Определить единицу измерения
     text = parent["Text"] OR child["Text"]
     IF "за 1 кв" IN text OR "за 1 м2" IN text:
       unit = "кв.м."
     ELIF "за 1 шт" IN text:
       unit = "шт."
     ELIF "за 1 п.м" IN text:
       unit = "п.м."
     ELSE:
       unit = "кв.м."  # по умолчанию
     
     # 3.5 Сформировать результат
     products.append({
       name: name,
       code: code,
       collection: mods.collection,
       color: mods.color,
       price: price,
       unit: unit,
       photo: child["Photo"] OR parent["Photo"],
       fullTitle: f'Тротуарная плитка "{name}" {code}'
     })
   
   RETURN products

# ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: extract_modifications
FUNCTION extract_modifications(row):
  sources = [
    row["Modifications"],
    row["Editions"],
    row["Modifications"] + ";" + row["Editions"],
    ...все_значения(row)  # сканировать всё
  ]
  
  FOR source IN sources:
    IF "Коллекция:" IN source AND "Цвет:" IN source:
      parts = source.split(";")
      FOR part IN parts:
        key, value = part.split(":")
        IF key.lower() == "коллекция": collection = value
        IF key.lower() == "цвет": color = value
      RETURN {collection, color}
  
  # Резерв: парсинг Title " - Collection - Color"
  title = row["Title"]
  match = regex(title, /\s-\s(.+?)\s-\s(.+?)$/)
  IF match:
    RETURN {collection: match[1], color: match[2]}
  
  RETURN {collection: "", color: ""}