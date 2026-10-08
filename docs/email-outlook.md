# Configurar Outlook/Hotmail no CV Studio local

Cada pessoa configura um registro Microsoft próprio e autoriza a própria conta na instalação local. O registro é feito uma vez e pode ser reutilizado pela mesma pessoa em outros computadores; não precisa ser recriado a cada execução do projeto. Cada instalação faz seu login e guarda suas credenciais localmente.

O fluxo atual atende contas Microsoft pessoais, como Outlook.com, Hotmail e Live. Usa OAuth2 com código de dispositivo; não utiliza senha de app. Contas corporativas Microsoft 365 não são o alvo desta configuração.

## 1. Registrar seu aplicativo Microsoft

1. Acesse o [Microsoft Entra](https://entra.microsoft.com/) e abra **Entra ID → Registros de aplicativos → Novo registro**.
2. Informe o nome **CV Studio**.
3. Em **Tipos de conta com suporte**, selecione **Somente contas Microsoft pessoais** ou a opção que aceita **qualquer diretório organizacional e contas Microsoft pessoais**.
4. Deixe a URI de redirecionamento vazia e clique em **Registrar**.
5. Em **Visão geral**, copie o **ID do aplicativo (cliente)**, também chamado **Application (client) ID**. Não copie o ID do objeto ou o ID do diretório.

É necessário acesso a um diretório Entra com permissão de registrar aplicativos; apenas ter uma caixa Hotmail não garante esse acesso. Se o portal impedir o registro, resolva o acesso ao diretório antes de continuar. Os requisitos estão no [guia oficial Microsoft](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app).

## 2. Habilitar o login por código

1. No registro criado, abra **Autenticação**.
2. Em **Configurações avançadas**, habilite **Permitir fluxos de cliente público** e salve. Os nomes podem variar conforme a versão do portal.
3. Não crie segredo de cliente: o CV Studio usa um cliente público com código de dispositivo e não precisa de callback local ou público. Consulte a [configuração de clientes públicos da Microsoft](https://learn.microsoft.com/en-us/entra/identity-platform/scenario-desktop-app-configuration).

O projeto solicita os escopos `https://outlook.office.com/SMTP.Send` e `offline_access` no login: envio SMTP e renovação da autorização. Se disponível em **Permissões de API → Adicionar uma permissão**, você pode cadastrar **Office 365 Exchange Online → Permissões delegadas → SMTP.Send**. Se essa API não aparecer, prossiga para o consentimento durante o login; o fluxo solicita o escopo diretamente. Não substitua por `Microsoft Graph / Mail.Send` nem por `SMTP.SendAsApp`: são outros fluxos. Veja a [documentação de SMTP com OAuth2](https://learn.microsoft.com/en-us/exchange/client-developer/legacy-protocols/how-to-authenticate-an-imap-pop-smtp-application-by-using-oauth).

## 3. Configurar o client ID no `.env.local`

O client ID do registro Microsoft é gravado **apenas** em `.env.local`, na raiz do repositório, ao lado de `package.json`. A interface não tem campo para ele e a API ignora qualquer client ID enviado pelo navegador.

Crie ou edite `.env.local`, preservando quaisquer outras configurações:

```dotenv
CV_STUDIO_OUTLOOK_CLIENT_ID=SEU_ID_DO_APLICATIVO_MICROSOFT
```

Substitua o valor pelo UUID copiado em **Visão geral**. Não use o ID de outra pessoa. O client ID identifica o registro; não é uma senha.

- A API carrega `.env.local` ao iniciar. Um arquivo chamado apenas `.env` não é lido.
- Não use o prefixo `VITE_`: o ID é lido só pela API, nunca pelo bundle da interface.
- Não coloque email, nome do remetente, senha ou tokens no `.env.local`. Email e nome são informados na interface; tokens são gerados no login.
- `.env.local` é ignorado pelo Git. Em cada clone ou computador, crie o arquivo novamente.
- Uma variável `CV_STUDIO_OUTLOOK_CLIENT_ID` já exportada no terminal tem precedência sobre `.env.local`. Se o sistema usar outro aplicativo, confira com `echo $CV_STUDIO_OUTLOOK_CLIENT_ID`.

Inicie o projeto ou reinicie o processo se ele já estiver aberto:

```sh
pnpm run dev
```

Sem um client ID válido, a opção **Outlook / Hotmail** mostra um aviso com o nome da variável e **Entrar com Microsoft** fica desabilitado.

Para trocar de aplicativo, atualize o valor em `.env.local`, reinicie a API e faça uma nova autorização: os tokens anteriores pertencem ao registro anterior.

## 4. Autorizar a conta e testar a conexão

1. Abra <http://localhost:5173> e entre em **Vagas → Conectar email**.
2. Selecione **Outlook / Hotmail**, informe seu email pessoal completo e o nome do remetente.
3. Clique em **Entrar com Microsoft**. Se o botão estiver desabilitado com um aviso sobre `CV_STUDIO_OUTLOOK_CLIENT_ID`, volte à seção 3.
4. Copie o código pelo botão ao lado dele e clique em **Abrir login Microsoft**.
5. Na página Microsoft, cole o código, entre com a mesma conta informada no CV Studio e autorize o aplicativo.
6. Volte ao CV Studio e aguarde a confirmação automática. Se o código expirar, inicie novamente.

A API confirma o login SMTP antes de salvar a conta, sem enviar email. Após conectar, **Testar conexão** permite verificar a autenticação novamente.

## 5. Como fica a configuração local

| Configuração | Valor |
| --- | --- |
| Provedor | Outlook / Hotmail |
| Servidor SMTP | `smtp-mail.outlook.com` |
| Porta | `587` |
| Criptografia | STARTTLS obrigatório (`secure: false` indica ausência de TLS direto) |
| Autenticação | OAuth2 / XOAUTH2 |
| Client ID | Seu registro Microsoft, somente em `.env.local` (`CV_STUDIO_OUTLOOK_CLIENT_ID`) |
| Email e nome | Configurados na interface |
| Tokens | Gerados no login; nunca preenchidos manualmente |

A API usa a autoridade Microsoft `consumers`, guarda access token e refresh token em `data/mail-account.json` (permissão `0600`, fora do Git) e renova o acesso automaticamente. Não edite esse arquivo nem copie tokens para `.env` ou `.env.local`. Há uma conta de envio por instalação.

Para testar um envio real, cadastre uma vaga com destinatário que você controla, preencha assunto e pitch, escolha o currículo e confira a prévia antes de confirmar. O PDF é gerado pela API com o Chromium (`pnpm setup:pdf` uma vez); confira também o lixo eletrônico do destinatário.

## Problemas comuns e troca de computador

- **Aviso sobre `CV_STUDIO_OUTLOOK_CLIENT_ID`:** crie ou corrija a variável em `.env.local` na raiz e reinicie a API.
- **Aplicativo inválido ou não autorizado:** confira o client ID em `.env.local`, o suporte a contas pessoais e a opção de fluxos de cliente público.
- **Permissão inválida:** confira o escopo delegado `SMTP.Send` do Exchange Online e refaça o consentimento.
- **Login SMTP recusado:** confira se entrou com o mesmo endereço informado no sistema; a aprovação no navegador ainda precisa passar na verificação SMTP.
- **Autorização revogada:** faça **Entrar com Microsoft** novamente.
- **Novo computador ou novo clone:** crie `.env.local` com seu client ID e autorize a conta nessa instalação. Seu registro existente pode ser reutilizado; `.env.local` e tokens não vêm pelo Git.
- **Encerrar o uso:** **Desconectar** remove as credenciais locais. Para remover também o consentimento Microsoft, gerencie as [permissões de aplicativos da conta](https://account.live.com/consent/Manage).
