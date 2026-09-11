using LuckySpin.Api.Models;
using LuckySpin.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace LuckySpin.Api.Controllers;

[ApiController]
[Route("api/wallet")]
public sealed class WalletController : ApiControllerBase
{
    [HttpPost("deposit")]
    public IActionResult Deposit([FromBody] WalletRequest request) => Mutate(request, GameStore.TryDeposit);

    [HttpPost("transfer")]
    public IActionResult Transfer([FromBody] WalletRequest request) => Mutate(request, GameStore.TryTransferToPlay);

    [HttpPost("withdraw")]
    public IActionResult Withdraw([FromBody] WalletRequest request) => Mutate(request, GameStore.TryWithdraw);

    private delegate bool WalletOperation(PlayerAccount account, decimal amount, out string error);

    private IActionResult Mutate(WalletRequest request, WalletOperation operation)
    {
        if (!TryGetAccount(out var account)) return UnauthorizedResponse();
        return operation(account, request.Amount, out var error)
            ? Ok(GameStore.Snapshot(account))
            : BadRequest(new ApiError { Message = error });
    }
}
