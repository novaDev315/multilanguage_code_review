import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CodeIssue, IssueSeverity, IssueCategory } from '../analysis/types/analysis.types';

interface Vulnerability {
  id: string;
  package: string;
  version: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  fixedIn?: string;
  cve?: string;
  url?: string;
}

interface DependencyFile {
  type: 'npm' | 'pip' | 'maven' | 'gradle' | 'composer' | 'cargo' | 'go' | 'nuget' | 'gems';
  filePath: string;
  content: string;
}

interface KnownVulnerability {
  package: string;
  vulnerableVersions: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  fixedIn: string;
  cve?: string;
}

@Injectable()
export class DependencyScannerService {
  // Known vulnerabilities database (simplified - in production, use Snyk/NVD API)
  private knownVulnerabilities: KnownVulnerability[] = [
    // npm packages
    { package: 'lodash', vulnerableVersions: '<4.17.21', severity: 'critical', title: 'Prototype Pollution', description: 'Prototype pollution vulnerability in lodash', fixedIn: '4.17.21', cve: 'CVE-2021-23337' },
    { package: 'minimist', vulnerableVersions: '<1.2.6', severity: 'critical', title: 'Prototype Pollution', description: 'Prototype pollution in minimist', fixedIn: '1.2.6', cve: 'CVE-2021-44906' },
    { package: 'axios', vulnerableVersions: '<0.21.2', severity: 'high', title: 'Server-Side Request Forgery', description: 'SSRF vulnerability in axios', fixedIn: '0.21.2', cve: 'CVE-2021-3749' },
    { package: 'express', vulnerableVersions: '<4.17.3', severity: 'medium', title: 'Open Redirect', description: 'Open redirect vulnerability in express', fixedIn: '4.17.3', cve: 'CVE-2022-24999' },
    { package: 'node-fetch', vulnerableVersions: '<2.6.7', severity: 'high', title: 'Exposure of Sensitive Information', description: 'Information disclosure in node-fetch', fixedIn: '2.6.7', cve: 'CVE-2022-0235' },
    { package: 'moment', vulnerableVersions: '<2.29.4', severity: 'high', title: 'Path Traversal', description: 'Path traversal vulnerability in moment', fixedIn: '2.29.4', cve: 'CVE-2022-31129' },
    { package: 'jsonwebtoken', vulnerableVersions: '<9.0.0', severity: 'high', title: 'Algorithm Confusion', description: 'JWT algorithm confusion attack', fixedIn: '9.0.0', cve: 'CVE-2022-23529' },
    { package: 'shell-quote', vulnerableVersions: '<1.7.3', severity: 'critical', title: 'Command Injection', description: 'Improper neutralization of special elements', fixedIn: '1.7.3', cve: 'CVE-2021-42740' },
    { package: 'tar', vulnerableVersions: '<6.1.11', severity: 'high', title: 'Arbitrary File Overwrite', description: 'Arbitrary file creation/overwrite via symlink', fixedIn: '6.1.11', cve: 'CVE-2021-37701' },
    { package: 'glob-parent', vulnerableVersions: '<5.1.2', severity: 'high', title: 'ReDoS', description: 'Regular expression denial of service', fixedIn: '5.1.2', cve: 'CVE-2020-28469' },

    // Python packages
    { package: 'django', vulnerableVersions: '<3.2.15', severity: 'high', title: 'SQL Injection', description: 'SQL injection in QuerySet.explain()', fixedIn: '3.2.15', cve: 'CVE-2022-34265' },
    { package: 'flask', vulnerableVersions: '<2.2.5', severity: 'medium', title: 'Security Bypass', description: 'Possible bypass of security checks', fixedIn: '2.2.5' },
    { package: 'requests', vulnerableVersions: '<2.31.0', severity: 'medium', title: 'Information Disclosure', description: 'Proxy-Authorization header leakage', fixedIn: '2.31.0', cve: 'CVE-2023-32681' },
    { package: 'pillow', vulnerableVersions: '<9.3.0', severity: 'critical', title: 'Buffer Overflow', description: 'Heap buffer overflow in libwebp', fixedIn: '9.3.0', cve: 'CVE-2023-4863' },
    { package: 'pyyaml', vulnerableVersions: '<6.0', severity: 'critical', title: 'Arbitrary Code Execution', description: 'Unsafe YAML deserialization', fixedIn: '6.0', cve: 'CVE-2020-14343' },
    { package: 'urllib3', vulnerableVersions: '<1.26.5', severity: 'medium', title: 'ReDoS', description: 'Catastrophic backtracking', fixedIn: '1.26.5', cve: 'CVE-2021-33503' },
    { package: 'cryptography', vulnerableVersions: '<41.0.0', severity: 'high', title: 'Timing Attack', description: 'Timing side-channel vulnerability', fixedIn: '41.0.0', cve: 'CVE-2023-38325' },
    { package: 'numpy', vulnerableVersions: '<1.22.0', severity: 'critical', title: 'Buffer Overflow', description: 'Buffer overflow in array operations', fixedIn: '1.22.0', cve: 'CVE-2021-41496' },

    // Java/Maven packages
    { package: 'log4j-core', vulnerableVersions: '<2.17.1', severity: 'critical', title: 'Remote Code Execution', description: 'Log4Shell - JNDI injection RCE', fixedIn: '2.17.1', cve: 'CVE-2021-44228' },
    { package: 'spring-core', vulnerableVersions: '<5.3.18', severity: 'critical', title: 'Remote Code Execution', description: 'Spring4Shell RCE vulnerability', fixedIn: '5.3.18', cve: 'CVE-2022-22965' },
    { package: 'jackson-databind', vulnerableVersions: '<2.13.4', severity: 'high', title: 'Deserialization', description: 'Unsafe deserialization vulnerability', fixedIn: '2.13.4', cve: 'CVE-2022-42003' },
    { package: 'commons-text', vulnerableVersions: '<1.10.0', severity: 'critical', title: 'Remote Code Execution', description: 'Text4Shell RCE via string interpolation', fixedIn: '1.10.0', cve: 'CVE-2022-42889' },
    { package: 'snakeyaml', vulnerableVersions: '<2.0', severity: 'high', title: 'Denial of Service', description: 'DoS via crafted YAML', fixedIn: '2.0', cve: 'CVE-2022-1471' },

    // Ruby gems
    { package: 'rails', vulnerableVersions: '<7.0.4.1', severity: 'high', title: 'ReDoS', description: 'Regular expression denial of service', fixedIn: '7.0.4.1', cve: 'CVE-2023-22795' },
    { package: 'nokogiri', vulnerableVersions: '<1.13.10', severity: 'high', title: 'XXE', description: 'XML External Entity vulnerability', fixedIn: '1.13.10', cve: 'CVE-2022-23476' },
    { package: 'rack', vulnerableVersions: '<2.2.6.2', severity: 'medium', title: 'ReDoS', description: 'Denial of Service vulnerability', fixedIn: '2.2.6.2', cve: 'CVE-2022-44571' },

    // Go modules
    { package: 'golang.org/x/crypto', vulnerableVersions: '<0.0.0-20220314234659', severity: 'high', title: 'SSH Vulnerability', description: 'Panic in SSH server', fixedIn: '0.0.0-20220315160706' },
    { package: 'golang.org/x/net', vulnerableVersions: '<0.7.0', severity: 'high', title: 'HTTP/2 DoS', description: 'HTTP/2 denial of service', fixedIn: '0.7.0', cve: 'CVE-2022-41723' },
  ];

  constructor(private configService: ConfigService) {}

  /**
   * Scan dependencies from file content
   */
  async scanDependencies(files: { filePath: string; content: string }[]): Promise<CodeIssue[]> {
    const issues: CodeIssue[] = [];

    for (const file of files) {
      const depFile = this.identifyDependencyFile(file);
      if (depFile) {
        const vulnerabilities = await this.scanFile(depFile);
        issues.push(...this.vulnerabilitiesToIssues(vulnerabilities, file.filePath));
      }
    }

    return issues;
  }

  /**
   * Identify the type of dependency file
   */
  private identifyDependencyFile(file: { filePath: string; content: string }): DependencyFile | null {
    const fileName = file.filePath.split('/').pop() || '';

    if (fileName === 'package.json') {
      return { type: 'npm', filePath: file.filePath, content: file.content };
    }
    if (fileName === 'package-lock.json') {
      return { type: 'npm', filePath: file.filePath, content: file.content };
    }
    if (fileName === 'requirements.txt') {
      return { type: 'pip', filePath: file.filePath, content: file.content };
    }
    if (fileName === 'Pipfile' || fileName === 'Pipfile.lock') {
      return { type: 'pip', filePath: file.filePath, content: file.content };
    }
    if (fileName === 'pom.xml') {
      return { type: 'maven', filePath: file.filePath, content: file.content };
    }
    if (fileName === 'build.gradle' || fileName === 'build.gradle.kts') {
      return { type: 'gradle', filePath: file.filePath, content: file.content };
    }
    if (fileName === 'composer.json' || fileName === 'composer.lock') {
      return { type: 'composer', filePath: file.filePath, content: file.content };
    }
    if (fileName === 'Cargo.toml' || fileName === 'Cargo.lock') {
      return { type: 'cargo', filePath: file.filePath, content: file.content };
    }
    if (fileName === 'go.mod' || fileName === 'go.sum') {
      return { type: 'go', filePath: file.filePath, content: file.content };
    }
    if (fileName.endsWith('.csproj') || fileName === 'packages.config') {
      return { type: 'nuget', filePath: file.filePath, content: file.content };
    }
    if (fileName === 'Gemfile' || fileName === 'Gemfile.lock') {
      return { type: 'gems', filePath: file.filePath, content: file.content };
    }

    return null;
  }

  /**
   * Scan a dependency file for vulnerabilities
   */
  private async scanFile(depFile: DependencyFile): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];
    const dependencies = this.parseDependencies(depFile);

    for (const [packageName, version] of dependencies) {
      const vulns = this.checkPackage(packageName, version, depFile.type);
      vulnerabilities.push(...vulns);
    }

    return vulnerabilities;
  }

  /**
   * Parse dependencies from file content
   */
  private parseDependencies(depFile: DependencyFile): Map<string, string> {
    const deps = new Map<string, string>();

    switch (depFile.type) {
      case 'npm':
        return this.parseNpmDependencies(depFile.content);
      case 'pip':
        return this.parsePipDependencies(depFile.content);
      case 'maven':
        return this.parseMavenDependencies(depFile.content);
      case 'gradle':
        return this.parseGradleDependencies(depFile.content);
      case 'gems':
        return this.parseGemfileDependencies(depFile.content);
      case 'go':
        return this.parseGoDependencies(depFile.content);
      case 'cargo':
        return this.parseCargoDependencies(depFile.content);
      case 'composer':
        return this.parseComposerDependencies(depFile.content);
      case 'nuget':
        return this.parseNugetDependencies(depFile.content);
      default:
        return deps;
    }
  }

  private parseNpmDependencies(content: string): Map<string, string> {
    const deps = new Map<string, string>();
    try {
      const pkg = JSON.parse(content);
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
        ...pkg.peerDependencies,
      };
      for (const [name, version] of Object.entries(allDeps)) {
        if (typeof version === 'string') {
          deps.set(name, version.replace(/[\^~>=<]/g, ''));
        }
      }
    } catch (e) {
      // Invalid JSON, skip
    }
    return deps;
  }

  private parsePipDependencies(content: string): Map<string, string> {
    const deps = new Map<string, string>();
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Handle various pip formats: package==1.0.0, package>=1.0.0, package
      const match = trimmed.match(/^([a-zA-Z0-9_-]+)(?:[=<>!]+)?([0-9.]*)?/);
      if (match) {
        deps.set(match[1].toLowerCase(), match[2] || 'latest');
      }
    }
    return deps;
  }

  private parseMavenDependencies(content: string): Map<string, string> {
    const deps = new Map<string, string>();

    // Simple XML parsing for Maven
    const depRegex = /<dependency>[\s\S]*?<artifactId>([^<]+)<\/artifactId>[\s\S]*?<version>([^<]+)<\/version>[\s\S]*?<\/dependency>/g;
    let match;

    while ((match = depRegex.exec(content)) !== null) {
      deps.set(match[1], match[2]);
    }
    return deps;
  }

  private parseGradleDependencies(content: string): Map<string, string> {
    const deps = new Map<string, string>();

    // Match various Gradle dependency formats
    const patterns = [
      /implementation\s+['"]([^:]+):([^:]+):([^'"]+)['"]/g,
      /compile\s+['"]([^:]+):([^:]+):([^'"]+)['"]/g,
      /api\s+['"]([^:]+):([^:]+):([^'"]+)['"]/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        deps.set(match[2], match[3]);
      }
    }
    return deps;
  }

  private parseGemfileDependencies(content: string): Map<string, string> {
    const deps = new Map<string, string>();
    const lines = content.split('\n');

    for (const line of lines) {
      // Match: gem 'name', '~> 1.0' or gem 'name', '>= 1.0'
      const match = line.match(/gem\s+['"]([^'"]+)['"](?:,\s*['"]([^'"]+)['"])?/);
      if (match) {
        deps.set(match[1], (match[2] || 'latest').replace(/[~><=]/g, '').trim());
      }
    }
    return deps;
  }

  private parseGoDependencies(content: string): Map<string, string> {
    const deps = new Map<string, string>();
    const lines = content.split('\n');

    for (const line of lines) {
      // Match: require github.com/pkg/name v1.0.0
      const match = line.match(/(?:require\s+)?([^\s]+)\s+v?([0-9.]+)/);
      if (match) {
        const pkgName = match[1].split('/').pop() || match[1];
        deps.set(match[1], match[2]);
      }
    }
    return deps;
  }

  private parseCargoDependencies(content: string): Map<string, string> {
    const deps = new Map<string, string>();

    // Simple TOML parsing for Cargo
    const lines = content.split('\n');
    let inDependencies = false;

    for (const line of lines) {
      if (line.match(/\[dependencies\]/)) {
        inDependencies = true;
        continue;
      }
      if (line.match(/\[.*\]/) && inDependencies) {
        inDependencies = false;
        continue;
      }
      if (inDependencies) {
        const match = line.match(/^([a-zA-Z0-9_-]+)\s*=\s*["']?([0-9.]+)["']?/);
        if (match) {
          deps.set(match[1], match[2]);
        }
      }
    }
    return deps;
  }

  private parseComposerDependencies(content: string): Map<string, string> {
    const deps = new Map<string, string>();
    try {
      const pkg = JSON.parse(content);
      const allDeps = { ...pkg.require, ...pkg['require-dev'] };
      for (const [name, version] of Object.entries(allDeps)) {
        if (typeof version === 'string' && !name.startsWith('php')) {
          deps.set(name.split('/').pop() || name, version.replace(/[\^~>=<]/g, ''));
        }
      }
    } catch (e) {
      // Invalid JSON, skip
    }
    return deps;
  }

  private parseNugetDependencies(content: string): Map<string, string> {
    const deps = new Map<string, string>();

    // Parse .csproj or packages.config
    const pkgRegex = /<PackageReference\s+Include="([^"]+)"\s+Version="([^"]+)"/g;
    const pkgConfigRegex = /<package\s+id="([^"]+)"\s+version="([^"]+)"/g;

    let match;
    while ((match = pkgRegex.exec(content)) !== null) {
      deps.set(match[1], match[2]);
    }
    while ((match = pkgConfigRegex.exec(content)) !== null) {
      deps.set(match[1], match[2]);
    }
    return deps;
  }

  /**
   * Check a package against known vulnerabilities
   */
  private checkPackage(packageName: string, version: string, type: string): Vulnerability[] {
    const vulnerabilities: Vulnerability[] = [];
    const normalizedName = packageName.toLowerCase();

    for (const vuln of this.knownVulnerabilities) {
      if (vuln.package.toLowerCase() === normalizedName) {
        // Simple version comparison (in production, use semver)
        if (this.isVulnerableVersion(version, vuln.vulnerableVersions)) {
          vulnerabilities.push({
            id: vuln.cve || `VULN-${vuln.package}`,
            package: packageName,
            version,
            severity: vuln.severity,
            title: vuln.title,
            description: vuln.description,
            fixedIn: vuln.fixedIn,
            cve: vuln.cve,
            url: vuln.cve ? `https://nvd.nist.gov/vuln/detail/${vuln.cve}` : undefined,
          });
        }
      }
    }

    return vulnerabilities;
  }

  /**
   * Simple version vulnerability check
   */
  private isVulnerableVersion(currentVersion: string, vulnerableVersions: string): boolean {
    // Parse vulnerable version constraint
    const match = vulnerableVersions.match(/^<(.+)$/);
    if (!match) return false;

    const fixedVersion = match[1];
    return this.compareVersions(currentVersion, fixedVersion) < 0;
  }

  /**
   * Compare two version strings
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    const maxLen = Math.max(parts1.length, parts2.length);

    for (let i = 0; i < maxLen; i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 < p2) return -1;
      if (p1 > p2) return 1;
    }
    return 0;
  }

  /**
   * Convert vulnerabilities to CodeIssue format
   */
  private vulnerabilitiesToIssues(vulnerabilities: Vulnerability[], filePath: string): CodeIssue[] {
    return vulnerabilities.map((vuln, index) => ({
      id: `vuln-${vuln.id}-${index}`,
      filePath,
      lineNumber: 1, // Dependency files don't have specific lines
      endLineNumber: undefined,
      severity: this.mapSeverity(vuln.severity),
      category: IssueCategory.SECURITY,
      message: `[${vuln.severity.toUpperCase()}] ${vuln.package}@${vuln.version}: ${vuln.title}. ${vuln.description}`,
      fixSuggestion: vuln.fixedIn
        ? `Upgrade ${vuln.package} to version ${vuln.fixedIn} or later`
        : `Review and update ${vuln.package} to a non-vulnerable version`,
      fixCode: vuln.fixedIn ? `"${vuln.package}": "${vuln.fixedIn}"` : undefined,
      ruleId: vuln.cve || `dependency-vuln-${vuln.package}`,
      language: 'dependency',
      confidence: 0.95,
      isFixApplied: false,
      isFalsePositive: false,
      createdAt: new Date(),
      cve: vuln.cve,
      vulnerabilityUrl: vuln.url,
    }));
  }

  private mapSeverity(severity: string): IssueSeverity {
    switch (severity) {
      case 'critical': return IssueSeverity.CRITICAL;
      case 'high': return IssueSeverity.HIGH;
      case 'medium': return IssueSeverity.MEDIUM;
      case 'low': return IssueSeverity.LOW;
      default: return IssueSeverity.MEDIUM;
    }
  }

  /**
   * Get summary of scan results
   */
  getScanSummary(issues: CodeIssue[]): {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    packages: string[];
  } {
    return {
      total: issues.length,
      critical: issues.filter(i => i.severity === IssueSeverity.CRITICAL).length,
      high: issues.filter(i => i.severity === IssueSeverity.HIGH).length,
      medium: issues.filter(i => i.severity === IssueSeverity.MEDIUM).length,
      low: issues.filter(i => i.severity === IssueSeverity.LOW).length,
      packages: [...new Set(issues.map(i => i.message.match(/^.*?\s([^\s@]+)@/)?.[1] || 'unknown'))],
    };
  }
}
