GROUP MEMBERS:
Praneeth Rangarajan
Rithwak Somepalli


Advanced function:
Our advanced function is a transport optimization engine that optimizes a product's order item based on carbon footprint, delivery time, and cost. Each order is stored across multiple rows representing individual journeys of an item, for example, an item shipped from South Korea to China, and then from China to the US, is stored as two rows, each with its own shipping address and a shared order ID with a journey sequence key, allowing the full route to be reconstructed. Once reconstructed, we calculate the total distance, along with the total delivery time and carbon cost across all  individual journeys. The item's routes will then be ranked based on the user's preferences, so a user can input if they want their orders in a specific timeframe or cost. The top-ranked routes are displayed on an interactive map, with each route drawn as a line with its total cost, delivery time, and carbon footprint.


Relational schema of database
PRODUCT (product_id, name, description, category, weight_kg)                                PK: product_id


SUPPLIER (supplier_id, name, contact_email, country, city)                                        PK: supplier_id


USER (user_id, name, email, co2_per_kg_prod)                                                          PK: user_id


TRANSPORT_METHOD (transport_id, mode, avg_speed_kmh, co2_per_km_kg)     PK: transport_id


CARBON_GOAL (goal_id, period, target_co2, actual_co2)                                          PK: goal_id


SUPPLIER_PRODUCT (supplier_id, product_id, price, priority, stock_qty)
    PK: (supplier_id, product_id)
    FK: supplier_id references SUPPLIER(supplier_id)
    FK: product_id references PRODUCT(product_id)


ORDER (order_id, user_id, transport_id, order_date, total_price, status, ship_addr)
    PK: order_id
    FK: user_id references USER(user_id)
    FK: transport_id references TRANSPORT_METHOD(transport_id)


ORDER_ITEM (order_id, item_id, quantity, unit_price, item_co2_kg)
    PK: (order_id, item_id)
    FK: order_id references ORDER(order_id)


makes (product_id, supplier_id)
    PK: (product_id, supplier_id)
    FK: product_id references PRODUCT(product_id)
    FK: supplier_id references SUPPLIER(supplier_id)


supplied-by (supplier_id, product_id)
    PK: (supplier_id, product_id)
    FK: supplier_id references SUPPLIER(supplier_id)
    FK: product_id references SUPPLIER_PRODUCT(product_id)


places (user_id, order_id)
    PK: (user_id, order_id)
    FK: user_id references USER(user_id)
    FK: order_id references ORDER(order_id)


contains (order_id, item_id)
    PK: (order_id, item_id)
    FK: order_id references ORDER(order_id)
    FK: item_id references ORDER_ITEM(item_id)


involves (supplier_id, product_id, item_id)
    PK: (supplier_id, product_id, item_id)
    FK: (supplier_id, product_id) references SUPPLIER_PRODUCT(supplier_id, product_id)
    FK: item_id references ORDER_ITEM(item_id)


uses (order_id, transport_id)
    PK: (order_id, transport_id)
    FK: order_id references ORDER(order_id)
    FK: transport_id references TRANSPORT_METHOD(transport_id)


Tech stack
We chose PostgreSQL hosted on Supabase because of its ability to handle complex relational queries, especially multi-table joins that our application requires. A relational database fits our schema perfectly, and Supabase also provides a hosted REST API that comes out of the box, which simplifies communication with the database. 
For the backend of the project, we decided to use Python because of its simplicity and extensive support, and pandas/numpy for comparing carbon footprint data across orders. 
For the frontend, we chose vanilla HTML/CSS/JS to keep it simple and fast to develop. We are combining this with the PyWebGUI library to package it as a desktop application, so the user doesn’t have to open an external browser to run it. 


Data gathering
Most companies treat supply chain, transportation routes, and carbon emission data as proprietary information. Due to this, we can’t find any public datasets that contain all the data we need for our application. Therefore, our project will use data that is made up.


User-related information like names and emails will be generated using the Python “Faker” library. This lets us create realistic but fake user data without relying on any real personal data. Product and supplier data will be manually created based on realistic examples of supply chains. We will make up a set of suppliers located in different countries and cities along with products that they provide. Transportation route data will also be manually created. For each supplier and product pair, we will define possible transportation routes and estimated distance, speed, and carbon emission factor for said routes. Finally, order data will be generated during testing by simulating users placing these orders in the application.
