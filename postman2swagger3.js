const fs = require('fs');

function postmanToOpenAPI(postmanCollection) {
    const openAPI = {
        openapi: "3.0.0",
        info: {
            title: postmanCollection.info.name,
            version: "1.0.0",
        },
        paths: {},
        components: {
            schemas: {},
            responses: {},
            securitySchemes: {},
        },
    };

    postmanCollection.item.forEach((folder) => {
        folder.item.forEach((requestItem) => {
            if (!requestItem.request) return;

            const request = requestItem.request;
            const url = request.url;
            if (!url) return;

            const method = request.method ? request.method.toLowerCase() : 'get';
            const path = '/' + (url.path || []).join('/').replace(/\{\{(.*?)\}\}/g, '{$1}');

            openAPI.paths[path] = openAPI.paths[path] || {};
            openAPI.paths[path][method] = {
                summary: requestItem.name || "",
                description: requestItem.name || "",
                parameters: [],
                responses: {},
                security: [],
            };

            // Detect path parameters from the URL and add them to parameters array
            const pathParams = path.match(/\{(.*?)\}/g);
            if (pathParams) {
                pathParams.forEach(param => {
                    const paramName = param.replace(/[{}]/g, '');
                    openAPI.paths[path][method].parameters.push({
                        name: paramName,
                        in: "path",
                        required: true,
                        schema: { type: "string" },
                        description: `Path parameter: ${paramName}`
                    });
                });
            }

            // Query parameters - remove duplicates based on name and in
            const uniqueQueryParams = {};
            (url.query || []).forEach(queryParam => {
                const uniqueKey = `${queryParam.key}_query`;
                if (!uniqueQueryParams[uniqueKey]) {
                    openAPI.paths[path][method].parameters.push({
                        name: queryParam.key,
                        in: "query",
                        required: !queryParam.disabled,
                        schema: { type: "string" },
                        description: queryParam.key
                    });
                    uniqueQueryParams[uniqueKey] = true;
                }
            });

            // Add requestBody only if method supports it (POST, PUT, PATCH)
            if (['post', 'put', 'patch'].includes(method) && request.body) {
                openAPI.paths[path][method].requestBody = {
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                example: JSON.parse(request.body.raw || "{}"),
                            }
                        }
                    }
                };
            }

            // Responses - simple default response handling
            if (requestItem.response && requestItem.response.length) {
                openAPI.paths[path][method].responses["200"] = {
                    description: "Successful response",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                example: JSON.parse(requestItem.response[0].body || "{}"),
                            }
                        }
                    }
                };
            } else {
                openAPI.paths[path][method].responses["default"] = {
                    description: "Default response"
                };
            }

            // Authorization handling
            const authHeader = request.header && request.header.find(h => h.key.toLowerCase() === "authorization");
            if (authHeader) {
                openAPI.components.securitySchemes.BearerAuth = {
                    type: "http",
                    scheme: "bearer",
                };
                openAPI.paths[path][method].security.push({ BearerAuth: [] });
            }
        });
    });

    return openAPI;
}

// Load Postman collection from local file and convert it
const inputFilePath = './postman_collection.json';
const outputFilePath = './openapi_output.json';

fs.readFile(inputFilePath, 'utf8', (err, data) => {
    if (err) {
        console.error("Error reading Postman collection file:", err);
        return;
    }

    const postmanCollection = JSON.parse(data);
    const openAPIJson = postmanToOpenAPI(postmanCollection);

    fs.writeFile(outputFilePath, JSON.stringify(openAPIJson, null, 2), (err) => {
        if (err) {
            console.error("Error writing OpenAPI file:", err);
        } else {
            console.log(`OpenAPI JSON saved to ${outputFilePath}`);
        }
    });
});
