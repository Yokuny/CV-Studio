# Configurar Gmail no CV Studio local

Cada pessoa conecta a própria conta Gmail na sua instalação. O projeto usa SMTP com senha de app; não é necessário registrar aplicativo no Google Cloud nem configurar OAuth.

## 1. Preparar a conta Google

1. Entre na conta Gmail que será usada como remetente.
2. Ative a [verificação em duas etapas](https://myaccount.google.com/signinoptions/two-step-verification).
3. Abra [Senhas de app](https://myaccount.google.com/apppasswords).
4. Crie uma senha de app com o nome **CV Studio** e copie os 16 caracteres mostrados. Use essa senha no CV Studio, em vez da senha normal da conta.

Se a opção não aparecer, confira se a verificação em duas etapas está ativa. Contas de organizações, Proteção Avançada ou configuração apenas com chaves de segurança podem restringir essa opção. A senha é exibida uma vez e é revogada quando a senha principal da conta muda. Veja a [ajuda oficial do Google](https://support.google.com/accounts/answer/185833?hl=pt-BR).

## 2. Configurar pela interface

1. Abra **Vagas → Conectar email**.
2. Selecione **Gmail**.
3. Preencha **Email** com o endereço completo da conta que gerou a senha.
4. Preencha **Nome do remetente** como deseja aparecer nos emails.
5. Cole a senha gerada no campo **Senha de app**.
6. Clique em **Salvar e testar** e aguarde a confirmação de conexão.

Esse botão testa a autenticação SMTP sem enviar email. A configuração só é gravada após o teste bem-sucedido; se falhar, a conta anterior é preservada. **Salvar** apenas grava a configuração, que fica pendente até validar a conexão.

## 3. Como fica a configuração local

Gmail não usa `.env.local`. No projeto, `.env.local` guarda apenas configuração de serviço, como o client ID Microsoft do Outlook (veja [email-outlook.md](email-outlook.md)); o Gmail não tem registro de aplicativo, então não há nada a gravar ali. Email, nome e senha de app são configurados pela interface e ficam em `data/mail-account.json`. Variáveis como `GMAIL_PASSWORD` ou `SMTP_PASSWORD` não são lidas pelo projeto; não coloque a senha de app em `.env` ou `.env.local`.

| Configuração | Valor |
| --- | --- |
| Provedor | Gmail |
| Servidor SMTP | `smtp.gmail.com` |
| Porta | `465` |
| Criptografia | TLS direto (`secure: true`) |
| Usuário | Seu endereço Gmail completo |
| Senha | Senha de app da mesma conta |

O sistema preenche servidor, porta e criptografia automaticamente. A API guarda as credenciais em `data/mail-account.json`, ignorado pelo Git e com permissão `0600`. Não crie nem edite esse arquivo manualmente; a senha não é devolvida ao navegador. Há uma conta de envio por instalação: conectar outra conta substitui a anterior.

## 4. Testar um envio

1. Cadastre uma vaga de teste com um destinatário que você controla e selecione a versão do currículo.
2. Preencha os dados da vaga, assunto e pitch.
3. Abra a prévia pelo botão de envio e confira destinatário, texto e PDF.
4. Confirme o envio. Confira o histórico da vaga e a caixa de entrada do destinatário, inclusive o lixo eletrônico.

A confirmação de conexão valida o login; o envio é uma ação separada. Para o PDF funcionar, mantenha `pnpm run dev` aberto e execute `pnpm setup:pdf` antes do primeiro envio.

## Problemas comuns e troca de computador

- **Autenticação recusada:** confira o endereço e use a senha de app gerada pela mesma conta. Se ela foi revogada, gere outra e faça **Salvar e testar** novamente.
- **Erro de conexão:** confira acesso à internet e bloqueios de firewall na porta 465.
- **Email no lixo eletrônico:** peça ao destinatário do teste para marcar como confiável; autenticação bem-sucedida não garante a pasta de entrega.
- **Novo computador ou novo clone:** repita a configuração pela interface; o Git não transporta credenciais. Você pode gerar uma senha de app específica para o novo computador.
- **Encerrar o uso:** clique em **Desconectar** para remover as credenciais locais e revogue a senha na página de Senhas de app do Google.
