class VerisureInstallation {
  constructor(installation, client) {
    this.giid = installation.giid;
    this.locale = installation.locale;
    this.config = installation;

    this.baseClient = client;
  }

  client({ variables, ...options }) {
    return this.baseClient({
      ...options,
      variables: {
        giid: this.giid,
        ...variables,
      },
    });
  }
}

module.exports = VerisureInstallation;
