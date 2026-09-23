using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Security.Principal;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

[assembly: AssemblyTitle("Central Restaurante S.A. Setup")]
[assembly: AssemblyProduct("Central Restaurante S.A.")]
[assembly: AssemblyVersion("1.4.1.0")]
[assembly: AssemblyFileVersion("1.4.1.0")]

namespace CentralRestauranteInstaller {
    static class Program {
        [STAThread]
        static void Main() {
            if (!IsAdministrator()) {
                try {
                    ProcessStartInfo proc = new ProcessStartInfo();
                    proc.UseShellExecute = true;
                    proc.WorkingDirectory = Environment.CurrentDirectory;
                    proc.FileName = Application.ExecutablePath;
                    proc.Verb = "runas";
                    Process.Start(proc);
                } catch {
                    MessageBox.Show("Esta instalação requer privilégios de Administrador para gravar na pasta Arquivos de Programas.", "Atenção", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                }
                return;
            }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
        }

        private static bool IsAdministrator() {
            var identity = WindowsIdentity.GetCurrent();
            var principal = new WindowsPrincipal(identity);
            return principal.IsInRole(WindowsBuiltInRole.Administrator);
        }
    }

    public class MainForm : Form {
        private Label lblTitle;
        private Label lblSubtitle;
        private Label lblStatus;
        private Label lblDestination;
        private ProgressBar progressBar;
        private CheckBox chkDesktopShortcut;
        private CheckBox chkStartMenuShortcut;
        private CheckBox chkLaunchApp;
        private Button btnInstall;
        private Button btnCancel;
        private Panel headerPanel;
        private Panel bottomPanel;
        private bool isFinished = false;

        public MainForm() {
            InitializeComponent();
        }

        private void InitializeComponent() {
            this.Text = "Instalação - Central Restaurante S.A. 1.4.1";
            this.Size = new Size(540, 390);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.MinimizeBox = true;
            this.BackColor = Color.FromArgb(248, 249, 250);
            this.Font = new Font("Segoe UI", 9F, FontStyle.Regular);

            // Load icon if available
            try {
                if (File.Exists("build\\icon.ico")) {
                    this.Icon = new Icon("build\\icon.ico");
                }
            } catch {}

            // Header Panel
            headerPanel = new Panel();
            headerPanel.Dock = DockStyle.Top;
            headerPanel.Height = 75;
            headerPanel.BackColor = Color.FromArgb(17, 24, 39); // Dark slate

            lblTitle = new Label();
            lblTitle.Text = "Central Restaurante S.A.";
            lblTitle.Font = new Font("Segoe UI", 14F, FontStyle.Bold);
            lblTitle.ForeColor = Color.White;
            lblTitle.Location = new Point(20, 15);
            lblTitle.AutoSize = true;

            lblSubtitle = new Label();
            lblSubtitle.Text = "Instalador do Sistema Oficial - Versão 1.4.1";
            lblSubtitle.Font = new Font("Segoe UI", 9.5F, FontStyle.Regular);
            lblSubtitle.ForeColor = Color.FromArgb(156, 163, 175);
            lblSubtitle.Location = new Point(22, 45);
            lblSubtitle.AutoSize = true;

            headerPanel.Controls.Add(lblTitle);
            headerPanel.Controls.Add(lblSubtitle);

            // Bottom Panel
            bottomPanel = new Panel();
            bottomPanel.Dock = DockStyle.Bottom;
            bottomPanel.Height = 60;
            bottomPanel.BackColor = Color.FromArgb(243, 244, 246);

            btnInstall = new Button();
            btnInstall.Text = "Instalar";
            btnInstall.Size = new Size(110, 34);
            btnInstall.Location = new Point(290, 13);
            btnInstall.BackColor = Color.FromArgb(16, 185, 129); // Brand emerald green
            btnInstall.ForeColor = Color.White;
            btnInstall.FlatStyle = FlatStyle.Flat;
            btnInstall.FlatAppearance.BorderSize = 0;
            btnInstall.Font = new Font("Segoe UI", 9.5F, FontStyle.Bold);
            btnInstall.Click += BtnInstall_Click;

            btnCancel = new Button();
            btnCancel.Text = "Cancelar";
            btnCancel.Size = new Size(95, 34);
            btnCancel.Location = new Point(410, 13);
            btnCancel.BackColor = Color.White;
            btnCancel.ForeColor = Color.FromArgb(55, 65, 81);
            btnCancel.FlatStyle = FlatStyle.Flat;
            btnCancel.FlatAppearance.BorderColor = Color.FromArgb(209, 213, 219);
            btnCancel.Click += (s, e) => this.Close();

            bottomPanel.Controls.Add(btnInstall);
            bottomPanel.Controls.Add(btnCancel);

            // Middle Content
            lblDestination = new Label();
            lblDestination.Text = "Pasta de Instalação: C:\\Program Files\\Central Restaurante S.A";
            lblDestination.Location = new Point(25, 95);
            lblDestination.AutoSize = true;
            lblDestination.ForeColor = Color.FromArgb(55, 65, 81);

            progressBar = new ProgressBar();
            progressBar.Location = new Point(25, 125);
            progressBar.Size = new Size(475, 26);
            progressBar.Minimum = 0;
            progressBar.Maximum = 100;
            progressBar.Value = 0;

            lblStatus = new Label();
            lblStatus.Text = "Pronto para instalar os componentes e o novo cardápio.";
            lblStatus.Location = new Point(25, 160);
            lblStatus.Size = new Size(475, 22);
            lblStatus.ForeColor = Color.FromArgb(107, 114, 128);

            chkDesktopShortcut = new CheckBox();
            chkDesktopShortcut.Text = "Criar atalho na Área de Trabalho";
            chkDesktopShortcut.Checked = true;
            chkDesktopShortcut.Location = new Point(25, 190);
            chkDesktopShortcut.AutoSize = true;

            chkStartMenuShortcut = new CheckBox();
            chkStartMenuShortcut.Text = "Criar atalho no Menu Iniciar";
            chkStartMenuShortcut.Checked = true;
            chkStartMenuShortcut.Location = new Point(25, 220);
            chkStartMenuShortcut.AutoSize = true;

            chkLaunchApp = new CheckBox();
            chkLaunchApp.Text = "Abrir o Central Restaurante S.A. ao concluir";
            chkLaunchApp.Checked = true;
            chkLaunchApp.Location = new Point(25, 250);
            chkLaunchApp.AutoSize = true;

            this.Controls.Add(headerPanel);
            this.Controls.Add(lblDestination);
            this.Controls.Add(progressBar);
            this.Controls.Add(lblStatus);
            this.Controls.Add(chkDesktopShortcut);
            this.Controls.Add(chkStartMenuShortcut);
            this.Controls.Add(chkLaunchApp);
            this.Controls.Add(bottomPanel);
        }

        private void BtnInstall_Click(object sender, EventArgs e) {
            if (isFinished) {
                if (chkLaunchApp.Checked) {
                    string exePath = @"C:\Program Files\Central Restaurante S.A\Central Restaurante S.A.exe";
                    if (File.Exists(exePath)) {
                        Process.Start(new ProcessStartInfo(exePath) { WorkingDirectory = Path.GetDirectoryName(exePath) });
                    }
                }
                this.Close();
                return;
            }

            btnInstall.Enabled = false;
            btnCancel.Enabled = false;
            chkDesktopShortcut.Enabled = false;
            chkStartMenuShortcut.Enabled = false;

            Thread t = new Thread(DoInstallation);
            t.IsBackground = true;
            t.Start();
        }

        private void DoInstallation() {
            try {
                UpdateStatus("Encerrando instâncias abertas do sistema...", 5);
                foreach (var p in Process.GetProcessesByName("Central Restaurante S.A")) {
                    try { p.Kill(); p.WaitForExit(3000); } catch {}
                }

                string targetDir = @"C:\Program Files\Central Restaurante S.A";
                if (!Directory.Exists(targetDir)) {
                    Directory.CreateDirectory(targetDir);
                }

                UpdateStatus("Carregando pacote de instalação...", 15);

                var assembly = Assembly.GetExecutingAssembly();
                using (var stream = assembly.GetManifestResourceStream("payload")) {
                    if (stream == null) {
                        throw new Exception("Recurso de instalação não encontrado no executável.");
                    }

                    using (var archive = new ZipArchive(stream, ZipArchiveMode.Read)) {
                        int total = archive.Entries.Count;
                        int count = 0;

                        foreach (var entry in archive.Entries) {
                            count++;
                            if (count % 15 == 0 || count == total) {
                                int pct = 15 + (int)(((double)count / total) * 70.0);
                                UpdateStatus("Extraindo: " + entry.Name, pct);
                            }

                            string destPath = Path.Combine(targetDir, entry.FullName);
                            if (string.IsNullOrEmpty(entry.Name)) {
                                Directory.CreateDirectory(destPath);
                            } else {
                                string parent = Path.GetDirectoryName(destPath);
                                if (!Directory.Exists(parent)) Directory.CreateDirectory(parent);
                                entry.ExtractToFile(destPath, true);
                            }
                        }
                    }
                }

                UpdateStatus("Criando atalhos...", 90);
                string mainExe = Path.Combine(targetDir, "Central Restaurante S.A.exe");

                if (chkDesktopShortcut.Checked) {
                    string desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                    CreateShortcut(Path.Combine(desktop, "Central Restaurante S.A.lnk"), mainExe, targetDir);
                }

                if (chkStartMenuShortcut.Checked) {
                    string startMenu = Environment.GetFolderPath(Environment.SpecialFolder.CommonPrograms);
                    CreateShortcut(Path.Combine(startMenu, "Central Restaurante S.A.lnk"), mainExe, targetDir);
                }

                UpdateStatus("Registrando informações de versão...", 95);
                RegisterUninstallInfo(targetDir, mainExe);

                UpdateStatus("Instalação concluída com sucesso!", 100);
                this.Invoke((MethodInvoker)delegate {
                    isFinished = true;
                    btnInstall.Text = "Concluir";
                    btnInstall.Enabled = true;
                    btnCancel.Visible = false;
                });
            } catch (Exception ex) {
                this.Invoke((MethodInvoker)delegate {
                    MessageBox.Show("Erro durante a instalação: " + ex.Message, "Erro", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    lblStatus.Text = "Falha na instalação.";
                    btnCancel.Enabled = true;
                });
            }
        }

        private void UpdateStatus(string text, int progress) {
            if (this.InvokeRequired) {
                this.Invoke((MethodInvoker)delegate { UpdateStatus(text, progress); });
                return;
            }
            lblStatus.Text = text;
            if (progress >= 0 && progress <= 100) progressBar.Value = progress;
        }

        private void CreateShortcut(string shortcutPath, string targetPath, string workingDir) {
            try {
                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                dynamic shell = Activator.CreateInstance(shellType);
                dynamic shortcut = shell.CreateShortcut(shortcutPath);
                shortcut.TargetPath = targetPath;
                shortcut.WorkingDirectory = workingDir;
                shortcut.Description = "Sistema Central Restaurante S.A.";
                shortcut.IconLocation = targetPath + ",0";
                shortcut.Save();
            } catch {}
        }

        private void RegisterUninstallInfo(string installDir, string mainExe) {
            try {
                using (var key = Registry.LocalMachine.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\Central Restaurante S.A")) {
                    if (key != null) {
                        key.SetValue("DisplayName", "Central Restaurante S.A.");
                        key.SetValue("DisplayVersion", "1.4.1");
                        key.SetValue("Publisher", "Matheus Tsuji");
                        key.SetValue("InstallLocation", installDir);
                        key.SetValue("DisplayIcon", mainExe);
                        key.SetValue("NoModify", 1, RegistryValueKind.DWord);
                        key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
                    }
                }
            } catch {}
        }
    }
}
