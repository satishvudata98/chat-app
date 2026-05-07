import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

const http = httpRouter();

http.route({
  path: "/add",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    
    if (!id) {
      return new Response("Missing user ID", { status: 400 });
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Add Friend on ChatNext</title>
          <style>
            body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f5f5f5; }
            .btn { background-color: #00A884; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin-top: 20px;}
          </style>
          <script>
            setTimeout(() => {
              window.location.href = "chatapp://user/${id}";
            }, 500);
          </script>
        </head>
        <body>
          <h2>Opening ChatNext...</h2>
          <p>If the app doesn't open automatically, tap the button below.</p>
          <a href="chatapp://user/${id}" class="btn">Open ChatNext</a>
        </body>
      </html>
    `;
    
    return new Response(html, {
      status: 200,
      headers: new Headers({
        "Content-Type": "text/html",
      }),
    });
  }),
});

export default http;
