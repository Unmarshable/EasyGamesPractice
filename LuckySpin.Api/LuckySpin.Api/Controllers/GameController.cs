using LuckySpin.Api.Models;
using LuckySpin.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace LuckySpin.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class GameController : ApiControllerBase
{
    [HttpGet("test")]
    public IActionResult Test() => Ok(new { message = "Lucky Spin API is working!" });

    [HttpPost("spin")]
    public IActionResult Spin([FromBody] SpinRequest request)
    {
        if (!TryGetAccount(out var account)) return UnauthorizedResponse();
        return GameStore.TrySpin(account, request, out var response, out var error)
            ? Ok(response)
            : BadRequest(new ApiError { Message = error });
    }
}
