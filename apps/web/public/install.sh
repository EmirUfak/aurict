#!/usr/bin/env bash
# Install the latest Aurict CLI release on macOS or Linux.
set -euo pipefail

readonly REPOSITORY="aurict/aurict"
readonly RELEASE_BASE_URL="${AURICT_RELEASE_BASE_URL:-https://github.com/${REPOSITORY}/releases}"
readonly INSTALL_DIR="${AURICT_INSTALL_DIR:-${HOME}/.local/bin}"
readonly REQUESTED_VERSION="${AURICT_INSTALL_VERSION:-}"

fail() {
  printf 'aurict install: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "${1} is required to install Aurict."
}

detect_platform() {
  case "$(uname -s)" in
    Linux) printf 'linux' ;;
    Darwin) printf 'darwin' ;;
    *) fail "unsupported operating system: $(uname -s). Use npm on Windows." ;;
  esac
}

detect_architecture() {
  case "$(uname -m)" in
    x86_64 | amd64) printf 'x64' ;;
    arm64 | aarch64) printf 'arm64' ;;
    *) fail "unsupported architecture: $(uname -m)." ;;
  esac
}

sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
    return
  fi
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
    return
  fi
  fail "sha256sum or shasum is required to verify the release."
}

main() {
  require_command curl
  require_command install

  local platform architecture asset version release_url temp_dir manifest binary expected actual
  platform="$(detect_platform)"
  architecture="$(detect_architecture)"
  asset="aurict-${platform}-${architecture}"
  version="${REQUESTED_VERSION#v}"

  if [[ -n "${version}" ]]; then
    release_url="${RELEASE_BASE_URL}/download/v${version}"
  else
    release_url="${RELEASE_BASE_URL}/latest/download"
  fi

  temp_dir="$(mktemp -d)"
  trap "rm -rf -- \"${temp_dir}\"" EXIT
  manifest="${temp_dir}/checksums.txt"
  binary="${temp_dir}/${asset}"

  printf 'Installing Aurict for %s/%s…\n' "${platform}" "${architecture}"
  curl --fail --location --silent --show-error --proto '=https' --tlsv1.2 \
    --output "${manifest}" "${release_url}/checksums.txt"
  curl --fail --location --silent --show-error --proto '=https' --tlsv1.2 \
    --output "${binary}" "${release_url}/${asset}"

  expected="$(awk -v asset="${asset}" '$2 == asset || $2 == "*" asset { print $1; exit }' "${manifest}")"
  [[ -n "${expected}" ]] || fail "release checksum for ${asset} was not found."
  actual="$(sha256 "${binary}")"
  [[ "${actual}" == "${expected}" ]] || fail "checksum verification failed for ${asset}."

  mkdir -p "${INSTALL_DIR}"
  install -m 0755 "${binary}" "${INSTALL_DIR}/aurict"
  "${INSTALL_DIR}/aurict" --version

  printf 'Installed Aurict to %s\n' "${INSTALL_DIR}/aurict"
  case ":${PATH}:" in
    *":${INSTALL_DIR}:"*) ;;
    *)
      printf 'Add it to your PATH, then restart the terminal:\n'
      printf '  export PATH="%s:$PATH"\n' "${INSTALL_DIR}"
      ;;
  esac
}

main "$@"
