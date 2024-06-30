# Node JS Express URL Shortener API

URL Shortener API with Postgresql and MongoDB
## Getting Started

### 1. Configure Environment Variables
Create a `.env` file in the root directory of the project and fill it with your configuration settings with basic value from `.example.env`.

### 2. Install Dependencies
Run the following command to install all the necessary modules:

```bash
npm install
```

### 3. Start the Development Server
To start the development server with nodemon, run:

```bash
npm run start-dev
```

This will start the server and automatically reload it when changes are detected.

### 4. Start the Production Server
To start the server in production mode, run:

```bash
npm start
```

### 5. API Documentation
API documentation is available via Swagger. Once the server is running, you can access the documentation at:

```
http://BASEURL/api-docs
```

Replace `BASEURL` with your actual base URL (e.g., `http://localhost:3000`).

If you need to edit the API documentation, you can modify the `swagger.yaml` file located in the `utils` directory.

```plaintext
utils/swagger.yaml
```
