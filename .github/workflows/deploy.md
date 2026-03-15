name: Deploy to Pages
on: [push]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: 22 }
    - run: npm ci
    - run: npm run build  # if needed
    - uses: cloudflare/pages-action@v1
      with:
        apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        accountId: d0ab4a941004d8666f9dce08c4553abf  # your account ID
        projectName: mbg-monitor
        directory: .
        gitHubToken: ${{ secrets.GITHUB_TOKEN }}
