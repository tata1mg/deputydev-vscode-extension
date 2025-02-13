# DeputyDev Vscode Extension




## Documentation

For a deeper dive into how this sample works, read the guides below.

- [Extension structure](./docs/extension-structure.md)
- [Extension commands](./docs/extension-commands.md)
- [Extension development cycle](./docs/extension-development-cycle.md)


### Setting Up Environment Variables

Create a `.env` file inside the `webview-ui` directory and add the following (for testing chat interface):

```
VITE_NEXT_PUBLIC_ANTHROPIC_KEY=<your_anthropic_api_key>
```

Replace `<your_anthropic_api_key>` with your actual API key.


## Run The Sample

```bash
# Clone the sample extension repository locally
git clone https://github.com/tata1mg/deputydev-vscode-extension.git DeputyDev-Extension

# Navigate into the cloned repository directory
cd DeputyDev-Extension

# Install all dependencies for the extension and webview UI
yarn install:all

# Build the webview UI source code
yarn build:ui


# Prepare the extension for publishing
yarn vscode:prepublish


```

Once the sample is open inside VS Code you can run the extension by doing the following:

1. Press `F5` to open a new Extension Development Host window
2. Inside the host window, click the new panda icon
