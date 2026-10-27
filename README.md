# Publish to GitHub Pages

## Upload

1. Open `release/priprema-za-ispit.zip` and extract it. GitHub does not unpack
   uploaded ZIP files into a website.
2. Sign in to GitHub and create a new **public repository**, for example
   `priprema-za-ispit`. This works with GitHub Free. Select **Add a README file**
   when creating the repository so the `main` branch exists.
3. In the repository, click **Add file → Upload files**. Open the extracted
   folder, select **its contents** and drag them into the upload area. Upload
   `assets/` as a folder alongside the other files. Do not upload the enclosing
   folder or the ZIP.
4. Click **Commit changes** and commit to `main`.

At the repository root you should see `index.html`, `app.js`, `styles.css`,
`navigation.js`, `welcome.js`, `welcome.css`, `settings.js`, `library.js`, `atmosphere.js`,
`atmosphere.css`, `THIRD_PARTY_NOTICES.md`, `ambience.js`, `questions.json`, `manifest.webmanifest`,
`service-worker.js`, `.nojekyll`, `README.md` and the `assets/` folder.
No terminal commands, dependencies or build service are needed.

## Enable Pages

5. Open **Settings → Pages** in the repository.
6. Under **Build and deployment**, set **Source → Deploy from a branch**.
7. Select **main** and **/(root)**, then **Save**.
8. Wait for the deployment to finish. The Pages screen will show the website
   link, normally `https://YOUR-USERNAME.github.io/priprema-za-ispit/`.
9. Enable **Enforce HTTPS** if the option is available. Open the HTTPS link
   on the phone and test a question, history, sound and settings.

The ZIP already has the correct layout for **/(root)**. Do not select `/docs`.
The app uses relative paths, so it works under the repository name in the URL.

## Add it to a phone

- **Android / Chrome:** open the HTTPS link, then use the browser menu's
  **Install app** or **Add to Home screen** option. The browser may also offer
  installation automatically; there is no custom install popup.
- **iPhone / Safari:** open the HTTPS link, tap **Share → Add to Home Screen**,
  leave **Open as Web App** enabled if shown, and tap **Add**.

Open the app once online to let the offline files finish caching. Ambient
playback starts only when Play is tapped. The published app is hosted by
GitHub, so the PC can be turned off.

Progress stays on each device/browser. The new HTTPS address has separate
storage from the local Wi-Fi preview; old local history will not transfer.

## Updates

Run `python package_web.py` from the project folder after editing the source.
Extract the new ZIP. In the same repository, choose **Add file → Upload files**,
drag in all extracted contents (including `assets/`), then **Commit changes** to
`main`. Files with matching paths are replaced. Check the repository's **Actions**
tab for the completed Pages deployment. The link and installed app stay the same.

On her phone, open the app online and leave it open briefly to download the update.
Then fully close it (remove it from recent apps) and reopen it. If she still sees
the old version, open the same Pages link in her browser and refresh, then reopen
the installed app. There is currently no update notification or forced reload.
Updates keep saved history and preferences on the same address and browser;
uninstalling or clearing site data is unnecessary and can remove local progress.

When editing the code manually, increment the service-worker cache version and
the changed script/style URL versions in `index.html` and `APP_SHELL` before
packaging. The supplied update packages already include these version changes.

## Official instructions

- [Upload files](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)
- [Choose a Pages publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)
